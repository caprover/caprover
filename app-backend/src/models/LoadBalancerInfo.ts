export default class LoadBalancerInfo {
    public activeConnections: number

    public accepted: number
    public handled: number
    public total: number

    public reading: number
    public writing: number
    public waiting: number
}