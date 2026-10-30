const MAX_TRACKED_IPS = 10000

/**
 * Fixed-window request counter per IP, in memory. Bounded: when too many IPs
 * are tracked at once, unknown IPs are refused until windows expire.
 */
class IpRateLimiter {
    private windows = new Map<string, { count: number; windowStart: number }>()

    constructor(
        private maxRequests: number,
        private windowMs: number,
        private now: () => number = Date.now
    ) {}

    isAllowed(ip: string): boolean {
        const currentTime = this.now()
        let entry = this.windows.get(ip)

        if (entry && currentTime - entry.windowStart >= this.windowMs) {
            this.windows.delete(ip)
            entry = undefined
        }

        if (!entry) {
            if (this.windows.size >= MAX_TRACKED_IPS) {
                this.windows.forEach((value, key) => {
                    if (currentTime - value.windowStart >= this.windowMs)
                        this.windows.delete(key)
                })
                if (this.windows.size >= MAX_TRACKED_IPS) return false
            }
            entry = { count: 0, windowStart: currentTime }
            this.windows.set(ip, entry)
        }

        entry.count++
        return entry.count <= this.maxRequests
    }
}

export default IpRateLimiter
