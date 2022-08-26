// Tools to analyse a headline
import {syllable} from "syllable";

class HeadlineEngineLang {
    static formatSentence(sentence: string): string {
        let s = sentence.replace(/[^a-zA-Z0-9]/g, " ").toLowerCase().trim();
        while(s.includes("  ")) {
            s = s.replace("  ", " ");
        }
        return s;
    }

    static wordCount(sentence: string): number {
        return this.formatSentence(sentence).split(" ").length;
    }

    static syllableCount(sentence: string): number {
        return syllable(this.formatSentence(sentence));
    }

    static sentenceCount(sentence: string): number {
        return (sentence.match(/[^!?.;]+/g) || []).length;
    }

    static fleschReadingEaseScore(sentence: string): number {
        var wordCount = this.wordCount(sentence);
        var sentenceCount = this.sentenceCount(sentence);
        var syllableCount = this.syllableCount(sentence);
        return Math.round(206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount));
    }

    static fleschKincaidGradeLevel(sentence: string): number {
        var wordCount = this.wordCount(sentence);
        var sentenceCount = this.sentenceCount(sentence);
        var syllableCount = this.syllableCount(sentence);
        return Math.round(0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59);
    }

    static letterCount(sentence: string, ignoreSpaces: boolean = false): number {
        if (ignoreSpaces) {
            return this.formatSentence(sentence).replace(/ /g, "").length;
        }
        return this.formatSentence(sentence).length;
    }

}

// Tests
function tests() {
    const headlines = [{
        headline: "10 This is a test  -  TITLE",
        formatted: "10 this is a test title",
        letters: 23,
        words: 6,
        sentences: 1,
        syllables: 6,
        fleschReadingEaseScore: 116,
        fleschKincaidGradeLevel: -1,
    },
    {
        headline: "Eight years of whistle-blower trauma; former SARS executive Johann van Loggerenberg",
        formatted: "eight years of whistle blower trauma former sars executive johann van loggerenberg",
        letters: 82,
        words: 12,
        sentences: 2,
        syllables: 23,
        fleschReadingEaseScore: 39,
        fleschKincaidGradeLevel: 9,
    },
    {
        headline: "This is a multi-sentence test. It has two sentences.",
        formatted: "this is a multi sentence test it has two sentences",
        letters: 50,
        words: 10,
        sentences: 2,
        syllables: 14,
        fleschReadingEaseScore: 83,
        fleschKincaidGradeLevel: 3,
    }];
    for (let headline of headlines) {
        console.assert(HeadlineEngineLang.formatSentence(headline.headline) === headline.formatted, `HeadlineEngineLang.formatSentence failed - expected ${headline.formatted}, got ${HeadlineEngineLang.formatSentence(headline.headline)} for "${headline.headline}"`);

        console.assert(HeadlineEngineLang.wordCount(headline.headline) === headline.words, `HeadlineEngineLang.wordCount failed - expected ${headline.words}, got ${HeadlineEngineLang.wordCount(headline.headline)} for "${headline.headline}"`);

        console.assert(HeadlineEngineLang.syllableCount(headline.headline) === headline.syllables, `HeadlineEngineLang.syllableCount failed - expected ${headline.syllables}, got ${HeadlineEngineLang.syllableCount(headline.headline)} for "${headline.headline}"`);

        console.assert(HeadlineEngineLang.sentenceCount(headline.headline) === headline.sentences, `HeadlineEngineLang.sentenceCount failed - expected ${headline.sentences}, got ${HeadlineEngineLang.sentenceCount(headline.headline)} for "${headline.headline}"`);

        console.assert(HeadlineEngineLang.fleschReadingEaseScore(headline.headline) === headline.fleschReadingEaseScore, `HeadlineEngineLang.fleschReadingEaseScore failed - expected ${headline.fleschReadingEaseScore}, got ${HeadlineEngineLang.fleschReadingEaseScore(headline.headline)} for "${headline.headline}"`);

        console.assert(HeadlineEngineLang.fleschKincaidGradeLevel(headline.headline) === headline.fleschKincaidGradeLevel, `HeadlineEngineLang.fleschKincaidGradeLevel failed - expected ${headline.fleschKincaidGradeLevel}, got ${HeadlineEngineLang.fleschKincaidGradeLevel(headline.headline)} for "${headline.headline}"`);

        console.assert(HeadlineEngineLang.letterCount(headline.headline) === headline.letters, `HeadlineEngineLang.letterCount failed - expected ${headline.letters}, got ${HeadlineEngineLang.letterCount(headline.headline)} for "${headline.headline}"`);
    }
}

tests();

export default HeadlineEngineLang;