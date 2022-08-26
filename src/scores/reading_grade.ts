import { IHeadlineEngineScorer } from "./headlineengine_score_interface";
import calc_total_score from "../libs/calc_total_score";
import HeadlineEngineLang from "../libs/headlineengine_lang";

declare var headlineengine_reading_grade_range_min;
declare var headlineengine_reading_grade_range_max;
declare var headlineengine_reading_grade_target;
export default class ReadabiltyScorer implements IHeadlineEngineScorer {
    reading_grade_range: [number, number];
    reading_grade_target: number;
    reading_grade_range_min: number;
    reading_grade_range_max: number;

    constructor() {
        this.reading_grade_range = [headlineengine_reading_grade_range_min || 45, headlineengine_reading_grade_range_max || 90];
        this.reading_grade_target = headlineengine_reading_grade_target || 55;
    }

    async init() {
        return;
    }

    message(score) {
        if (score < this.reading_grade_range[0]) {
            return `Too simple, use more complex words (Grade ${ score })`;
        } else if (score > this.reading_grade_range[1]) {
            return `Too complex, use less complex words (Grade ${ score })`;
        } else if (score === this.reading_grade_target) {
            return `Perfect (Grade ${ score })`;
        }
        return `Good (Grade ${ score })`;
    }

    score(headline: string) {
        const ease_score = HeadlineEngineLang.fleschKincaidGradeLevel(headline);
        const score = calc_total_score(ease_score, this.reading_grade_target, this.reading_grade_range);
        const message = this.message(ease_score);
        const pass = headline.length >= this.reading_grade_range[0] && headline.length <= this.reading_grade_range[1];
        return { name: "Reading Grade", score, message, pass };
    }
}