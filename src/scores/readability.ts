import { IHeadlineEngineScorer } from "./headlineengine_score_interface";
import calc_total_score from "../libs/calc_total_score";
import HeadlineEngineLang from "../libs/headlineengine_lang";

declare var headlineengine_readability_range_min;
declare var headlineengine_readability_range_max;
declare var headlineengine_readability_target;
export default class ReadabiltyScorer implements IHeadlineEngineScorer {
    readability_range: [number, number];
    readability_target: number;
    readability_range_min: number;
    readability_range_max: number;

    constructor() {
        this.readability_range = [headlineengine_readability_range_min || 45, headlineengine_readability_range_max || 90];
        this.readability_target = headlineengine_readability_target || 55;
    }

    async init() {
        return;
    }

    message(score) {
        if (score < this.readability_range[0]) {
            return `Too complex, use shorter words (Readability ${ score })`;
        } else if (score > this.readability_range[1]) {
            return `Too simple, use longer words (Readability ${ score })`;
        } else if (score === this.readability_target) {
            return `Perfect (Readability ${ score })`;
        }
        return `Good (Readability ${ score })`;
    }

    score(headline: string) {
        const ease_score = HeadlineEngineLang.fleschReadingEaseScore(headline);
        const score = calc_total_score(ease_score, this.readability_target, this.readability_range);
        const message = this.message(ease_score);
        const pass = headline.length >= this.readability_range[0] && headline.length <= this.readability_range[1];
        return { name: "Readability", score, message, pass };
    }
}