import { IHeadlineEngineScorer } from "./headlineengine_score_interface";
import calc_total_score from "../libs/calc_total_score";

declare var headlineengine_length_range_min;
declare var headlineengine_length_range_max;
declare var headlineengine_length_target;
export default class LetterCountScorer implements IHeadlineEngineScorer {
    length_range: [number, number];
    length_target: number;

    constructor() {
        this.length_range = [headlineengine_length_range_min || 40, headlineengine_length_range_max || 90];
        this.length_target = headlineengine_length_target || 82;
    }

    async init() {
        return;
    }

    message(length) {
        if (length < this.length_range[0]) {
            return `Too short, add ${ this.length_range[0] - length } letter${ this.length_range[0] - length > 1 ? "s" : "" }`;
        } else if (length > this.length_range[1]) {
            return `Too long, remove ${ length - this.length_range[1] } letter${ this.length_range[0] - length > 1 ? "s" : "" }`;
        } else if (length === this.length_target) {
            return `Perfect (${ length } letters)`;
        }
        return `Good (${ length } letters)`;
    }

    score(headline: string) {
        const score = calc_total_score(headline.length, this.length_target, this.length_range);
        const message = this.message(headline.length);
        const pass = headline.length >= this.length_range[0] && headline.length <= this.length_range[1];
        return { name: "Letter count", score, message, pass };
    }
}