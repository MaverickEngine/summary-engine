import { IHeadlineEngineScorer } from "./headlineengine_score_interface";
import calc_total_score from "../libs/calc_total_score";

declare var headlineengine_wordcount_range_min;
declare var headlineengine_wordcount_range_max;
declare var headlineengine_wordcount_target;
export default class WordcountScorer implements IHeadlineEngineScorer {
    wordcount_range: [number, number];
    wordcount_target: number;

    constructor() {
        this.wordcount_range = [headlineengine_wordcount_range_min || 40, headlineengine_wordcount_range_max || 90];
        this.wordcount_target = headlineengine_wordcount_target || 82;
    }

    async init() {
        return;
    }

    message(wordcount) {
        if (wordcount < this.wordcount_range[0]) {
            return `Too short, add ${ this.wordcount_range[0] - wordcount } word${ this.wordcount_range[0] - wordcount > 1 ? "s" : "" }`;
        } else if (wordcount > this.wordcount_range[1]) {
            return `Too long, remove ${ wordcount - this.wordcount_range[1] } word${ this.wordcount_range[0] - wordcount > 1 ? "s" : "" }`;
        } else if (wordcount === this.wordcount_target) {
            return `Perfect (${ wordcount } words)`;
        }
        return `Good (${ wordcount } words)`;
    }

    score(headline: string) {
        const word_count = headline.replace(/-/g, ' ').trim().split(/\s+/g).length;
        const score = calc_total_score(word_count, this.wordcount_target, this.wordcount_range);
        const message = this.message(word_count);
        const pass = word_count >= this.wordcount_range[0] && word_count <= this.wordcount_range[1];
        return { name: "Word Count", score, message, pass };
    }

    test() {
        const headline = "   This   is\n a test-headline    ---";
        const score = this.score(headline);
        return(score.score === 5);
    }

}