import {Powerwords, Lettercount, Readability, Wordcount, ReadingGrade} from "./scores";

declare var headlineengine_powerwords_enable;
declare var headlineengine_length_enable;
declare var headlineengine_readability_enable;
declare var headlineengine_reading_grade_enable;
declare var headlineengine_wordcount_enable;

export default class Calc_Score {
    scorers: [any?] = [];
    initialized: boolean = false;

    async init() {
        if (headlineengine_powerwords_enable) {
            const powerwords = new Powerwords();
            this.scorers.push(powerwords);
        }
        if (headlineengine_length_enable) {
            const lettercount = new Lettercount();
            this.scorers.push(lettercount);
        }
        if (headlineengine_readability_enable) {
            const readability = new Readability();
            this.scorers.push(readability);
        }
        if (headlineengine_reading_grade_enable) {
            const reading_grade = new ReadingGrade();
            this.scorers.push(reading_grade);
        }
        if (headlineengine_wordcount_enable) {
            const wordcount = new Wordcount();
            this.scorers.push(wordcount);
        }
        for (let scorer of this.scorers) {
            await scorer.init()
        }
        this.initialized = true;
    }

    async score(headline: string) {
        if (!this.initialized) await this.init();
        const scores = await Promise.all(this.scorers.map(s => s.score(headline)));
        const total_score = scores.reduce((acc, curr) => acc + curr.score, 0) / scores.length;
        return {scores, total_score};
    }
}

// Tests
async function tests() {
    const scores = [
        {
            val: 50,
            target: 50,
            range: [0, 100],
            expected: 1
        },
        {
            val: 50,
            target: 25,
            range: [0, 50],
            expected: 0
        },
        {
            val: 50,
            target: 50,
            range: [50, 100],
            expected: 1
        },
        {
            val: 75,
            target: 50,
            range: [0, 100],
            expected: 0.5
        }
    ];
    // scores.forEach(score => {
    //     console.assert(calc_total_score(score.val, score.target, score.range) === score.expected, `calc_total_score(${score.val}, ${score.target}, [${score.range[0]}, ${score.range[1]}]) !== ${score.expected}; ${calc_total_score(score.val, score.target, score.range)}`);
    // });
    // const tests = [
    //     {
    //         headline: "Eight years of whistle-blower trauma; former SARS executive Johann van Loggerenberg",
    //         length: { score: 1, rating: "good", length: 19, message: "Good", pass: true },
    //         readability: { score: 1, rating: "good", ease_score: 55, message: "Good", pass: true },
    //         powerwords: { score: 1, rating: 1, words: ["this", "is", "a", "test", "headline"], pass: true }
    //     },
    //     {
    //         headline: "This is a test headline",
    //         length: { score: 1, rating: "good", length: 19, message: "Good", pass: true },
    //         readability: { score: 1, rating: "good", ease_score: 55, message: "Good", pass: true },
    //         powerwords: { score: 1, rating: 1, words: ["this", "is", "a", "test", "headline"], pass: true }
    //     }
    // ];
    // tests.forEach(async test => {
    //     const result = await calc_score(test.headline);
    //     console.log(result);
    // }
    // );
}
// tests();

// export default calc_score;