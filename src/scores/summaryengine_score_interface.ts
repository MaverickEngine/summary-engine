export interface IHeadlineEngineScore {
    name: string
    pass: boolean
    score: number
    message: string
    mouseover_message?: string
}

export interface IHeadlineEngineScorer {
    init: () => Promise<void>
    score: (headline: string) => IHeadlineEngineScore
}