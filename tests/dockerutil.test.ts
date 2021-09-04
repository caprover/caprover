// @ts-ignore
import dockerodeUtils = require('dockerode/lib/util')

test('dockerodeUtils', () => {
    {
        const parsed = dockerodeUtils.parseRepositoryTag('lib/repo:tag.v1.0')
        expect(parsed.tag).toBe('tag.v1.0')
        expect(parsed.repository).toBe('lib/repo')
    }

    {
        const parsed = dockerodeUtils.parseRepositoryTag(
            'domain.com:3000/lib/repo:tag.v1.0'
        )
        expect(parsed.tag).toBe('tag.v1.0')
        expect(parsed.repository).toBe('domain.com:3000/lib/repo')
    }

    {
        const parsed = dockerodeUtils.parseRepositoryTag(
            'domain.com:3000/repo:tag.v1.0'
        )
        expect(parsed.tag).toBe('tag.v1.0')
        expect(parsed.repository).toBe('domain.com:3000/repo')
    }
})
