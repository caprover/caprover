export interface DockerJsonMessage {
    stream?: string
    error?: any
    errorDetail?: any
    id?: string
    aux?: unknown
}

interface ProtobufValue {
    value: number
    offset: number
}

interface ProtobufBytes {
    value: Buffer
    offset: number
}

interface BuildKitVertex {
    digest: string
    name: string
    error: string
}

interface BuildKitStatus {
    vertices: BuildKitVertex[]
    logs: Buffer[]
    warnings: Buffer[]
}

export class DockerJsonStreamParser {
    private pending = ''

    push(chunk: string): DockerJsonMessage[] {
        this.pending += chunk
        const messages: DockerJsonMessage[] = []
        let newlineIndex = this.pending.indexOf('\n')

        while (newlineIndex >= 0) {
            const line = this.pending.slice(0, newlineIndex)
            this.pending = this.pending.slice(newlineIndex + 1)
            const message = this.parseLine(line)
            if (message) {
                messages.push(message)
            }
            newlineIndex = this.pending.indexOf('\n')
        }

        return messages
    }

    flush(): DockerJsonMessage[] {
        const line = this.pending
        this.pending = ''
        const message = this.parseLine(line)
        return message ? [message] : []
    }

    private parseLine(line: string): DockerJsonMessage | undefined {
        const trimmed = line.trim()
        if (!trimmed) {
            return undefined
        }

        try {
            return JSON.parse(trimmed) as DockerJsonMessage
        } catch (ignore) {
            return {
                stream: `Cannot parse ${trimmed}`,
            }
        }
    }
}

export class DockerBuildOutputDecoder {
    private displayedVertices = new Set<string>()
    private displayedErrors = new Set<string>()

    decode(message: DockerJsonMessage): DockerJsonMessage[] {
        const output: DockerJsonMessage[] = []

        if (message.stream || message.error) {
            output.push(message)
        }

        if (
            message.id !== 'moby.buildkit.trace' ||
            typeof message.aux !== 'string'
        ) {
            return output
        }

        try {
            const status = decodeBuildKitStatus(
                Buffer.from(message.aux, 'base64')
            )

            status.vertices.forEach((vertex) => {
                const vertexId = vertex.digest || vertex.name
                if (
                    vertex.name &&
                    vertexId &&
                    !this.displayedVertices.has(vertexId)
                ) {
                    this.displayedVertices.add(vertexId)
                    output.push({ stream: `${vertex.name}\n` })
                }

                if (vertex.error && !this.displayedErrors.has(vertex.error)) {
                    this.displayedErrors.add(vertex.error)
                    output.push({
                        error: vertex.error,
                        errorDetail: { message: vertex.error },
                    })
                }
            })

            status.logs.forEach((log) => {
                const text = log.toString('utf8')
                if (text) {
                    output.push({ stream: text })
                }
            })

            status.warnings.forEach((warning) => {
                const text = warning.toString('utf8').trim()
                if (text) {
                    output.push({ stream: `WARNING: ${text}\n` })
                }
            })
        } catch (ignore) {
            output.push({ stream: 'Cannot parse BuildKit build output\n' })
        }

        return output
    }
}

function decodeBuildKitStatus(buffer: Buffer): BuildKitStatus {
    const status: BuildKitStatus = {
        vertices: [],
        logs: [],
        warnings: [],
    }
    let offset = 0

    while (offset < buffer.length) {
        const tag = readVarint(buffer, offset)
        offset = tag.offset
        const fieldNumber = Math.floor(tag.value / 8)
        const wireType = tag.value % 8

        if (wireType === 2 && fieldNumber === 1) {
            const value = readBytes(buffer, offset)
            offset = value.offset
            status.vertices.push(decodeVertex(value.value))
        } else if (wireType === 2 && fieldNumber === 3) {
            const value = readBytes(buffer, offset)
            offset = value.offset
            const log = decodeVertexLog(value.value)
            if (log) {
                status.logs.push(log)
            }
        } else if (wireType === 2 && fieldNumber === 4) {
            const value = readBytes(buffer, offset)
            offset = value.offset
            const warning = decodeVertexWarning(value.value)
            if (warning) {
                status.warnings.push(warning)
            }
        } else {
            offset = skipField(buffer, offset, wireType)
        }
    }

    return status
}

function decodeVertex(buffer: Buffer): BuildKitVertex {
    const vertex: BuildKitVertex = { digest: '', name: '', error: '' }
    let offset = 0

    while (offset < buffer.length) {
        const tag = readVarint(buffer, offset)
        offset = tag.offset
        const fieldNumber = Math.floor(tag.value / 8)
        const wireType = tag.value % 8

        if (wireType === 2 && [1, 3, 7].includes(fieldNumber)) {
            const value = readBytes(buffer, offset)
            offset = value.offset
            const text = value.value.toString('utf8')
            if (fieldNumber === 1) vertex.digest = text
            if (fieldNumber === 3) vertex.name = text
            if (fieldNumber === 7) vertex.error = text
        } else {
            offset = skipField(buffer, offset, wireType)
        }
    }

    return vertex
}

function decodeVertexLog(buffer: Buffer): Buffer | undefined {
    return decodeBytesField(buffer, 4)
}

function decodeVertexWarning(buffer: Buffer): Buffer | undefined {
    return decodeBytesField(buffer, 3)
}

function decodeBytesField(
    buffer: Buffer,
    expectedFieldNumber: number
): Buffer | undefined {
    let offset = 0

    while (offset < buffer.length) {
        const tag = readVarint(buffer, offset)
        offset = tag.offset
        const fieldNumber = Math.floor(tag.value / 8)
        const wireType = tag.value % 8

        if (wireType === 2 && fieldNumber === expectedFieldNumber) {
            return readBytes(buffer, offset).value
        }

        offset = skipField(buffer, offset, wireType)
    }

    return undefined
}

function readVarint(buffer: Buffer, startOffset: number): ProtobufValue {
    let value = 0
    let multiplier = 1
    let offset = startOffset

    for (let byteCount = 0; byteCount < 10; byteCount++) {
        if (offset >= buffer.length) {
            throw new Error('Invalid protobuf varint')
        }

        const byte = buffer[offset++]
        if (multiplier <= 2 ** 49) {
            value += (byte & 0x7f) * multiplier
        }
        if ((byte & 0x80) === 0) {
            return { value, offset }
        }
        multiplier *= 128
    }

    throw new Error('Invalid protobuf varint')
}

function readBytes(buffer: Buffer, startOffset: number): ProtobufBytes {
    const length = readVarint(buffer, startOffset)
    const endOffset = length.offset + length.value
    if (endOffset > buffer.length) {
        throw new Error('Invalid protobuf field length')
    }

    return {
        value: buffer.subarray(length.offset, endOffset),
        offset: endOffset,
    }
}

function skipField(
    buffer: Buffer,
    startOffset: number,
    wireType: number
): number {
    if (wireType === 0) {
        return readVarint(buffer, startOffset).offset
    }
    if (wireType === 1) {
        return ensureOffset(buffer, startOffset + 8)
    }
    if (wireType === 2) {
        return readBytes(buffer, startOffset).offset
    }
    if (wireType === 5) {
        return ensureOffset(buffer, startOffset + 4)
    }

    throw new Error(`Unsupported protobuf wire type ${wireType}`)
}

function ensureOffset(buffer: Buffer, offset: number): number {
    if (offset > buffer.length) {
        throw new Error('Invalid protobuf field')
    }
    return offset
}
