import {
    DockerBuildOutputDecoder,
    DockerJsonStreamParser,
} from '../src/docker/DockerBuildOutput'

function varint(value: number): Buffer {
    const bytes: number[] = []
    do {
        const remaining = Math.floor(value / 128)
        bytes.push(value % 128 | (remaining ? 0x80 : 0))
        value = remaining
    } while (value)
    return Buffer.from(bytes)
}

function bytesField(fieldNumber: number, value: string | Buffer): Buffer {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value)
    return Buffer.concat([
        varint(fieldNumber * 8 + 2),
        varint(data.length),
        data,
    ])
}

test('buffers split JSON messages and parses multiple messages', () => {
    const parser = new DockerJsonStreamParser()

    expect(parser.push('{"stream":"hel')).toEqual([])
    expect(parser.push('lo"}\n{"error":"failed"}\n')).toEqual([
        { stream: 'hello' },
        { error: 'failed' },
    ])
})

test('keeps buffers isolated and flushes the final message', () => {
    const first = new DockerJsonStreamParser()
    const second = new DockerJsonStreamParser()

    first.push('{"stream":"first"')
    second.push('{"stream":"second"}')

    expect(first.push('}\n')).toEqual([{ stream: 'first' }])
    expect(second.flush()).toEqual([{ stream: 'second' }])
})

test('reports malformed JSON without interrupting later messages', () => {
    const parser = new DockerJsonStreamParser()

    expect(parser.push('not-json\n{"stream":"still running"}\n')).toEqual([
        { stream: 'Cannot parse not-json' },
        { stream: 'still running' },
    ])
})

test('preserves traditional builder output', () => {
    const decoder = new DockerBuildOutputDecoder()
    const message = { stream: 'Step 1/1\n' }

    expect(decoder.decode(message)).toEqual([message])
})

test('decodes BuildKit vertices, logs, and warnings', () => {
    const vertex = Buffer.concat([
        bytesField(1, 'sha256:vertex'),
        bytesField(3, '[1/1] RUN npm test'),
    ])
    const log = Buffer.concat([
        bytesField(1, 'sha256:vertex'),
        bytesField(4, 'tests passed\n'),
    ])
    const warning = bytesField(3, 'deprecated instruction')
    const status = Buffer.concat([
        bytesField(1, vertex),
        bytesField(3, log),
        bytesField(4, warning),
    ])
    const decoder = new DockerBuildOutputDecoder()

    expect(
        decoder.decode({
            id: 'moby.buildkit.trace',
            aux: status.toString('base64'),
        })
    ).toEqual([
        { stream: '[1/1] RUN npm test\n' },
        { stream: 'tests passed\n' },
        { stream: 'WARNING: deprecated instruction\n' },
    ])

    expect(
        decoder.decode({
            id: 'moby.buildkit.trace',
            aux: bytesField(1, vertex).toString('base64'),
        })
    ).toEqual([])
})

test('decodes BuildKit vertex errors once with error details', () => {
    const vertex = Buffer.concat([
        bytesField(1, 'sha256:failed-vertex'),
        bytesField(3, '[1/1] RUN exit 1'),
        bytesField(7, 'process exited with code 1'),
    ])
    const message = {
        id: 'moby.buildkit.trace',
        aux: bytesField(1, vertex).toString('base64'),
    }
    const decoder = new DockerBuildOutputDecoder()

    expect(decoder.decode(message)).toEqual([
        { stream: '[1/1] RUN exit 1\n' },
        {
            error: 'process exited with code 1',
            errorDetail: { message: 'process exited with code 1' },
        },
    ])
    expect(decoder.decode(message)).toEqual([])
})

test('reports malformed BuildKit protobuf output', () => {
    const decoder = new DockerBuildOutputDecoder()

    expect(
        decoder.decode({
            id: 'moby.buildkit.trace',
            aux: Buffer.from([0x0a, 0x05, 0x01]).toString('base64'),
        })
    ).toEqual([{ stream: 'Cannot parse BuildKit build output\n' }])
})

test('ignores unrelated aux messages', () => {
    const decoder = new DockerBuildOutputDecoder()

    expect(
        decoder.decode({ id: 'other.message', aux: 'not-protobuf' })
    ).toEqual([])
})

test('skips 10-byte protobuf varints without dropping later output', () => {
    const fullWidthVarint = Buffer.from([
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
    ])
    const log = Buffer.concat([
        Buffer.from([0x08]),
        fullWidthVarint,
        bytesField(4, 'still visible\n'),
    ])
    const status = bytesField(3, log)
    const decoder = new DockerBuildOutputDecoder()

    expect(
        decoder.decode({
            id: 'moby.buildkit.trace',
            aux: status.toString('base64'),
        })
    ).toEqual([{ stream: 'still visible\n' }])
})
