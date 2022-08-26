import { IHeadlineEngineScorer } from "./headlineengine_score_interface";
declare var headlineengine_powerwords_api: any;

export default class PowerWordsScorer implements IHeadlineEngineScorer {
    powerword_list: string[] = [];
    // powerword_regex: RegExp;

    async init() {
        // if (this.powerword_list.length) return; // Cached
        this.powerword_list = await jQuery.get(headlineengine_powerwords_api)
        .catch(err => {
            console.log("Could not load Powerwords list"); 
            console.log(err);
            return [];
        });
        // this.powerword_regex = new RegExp(this.powerword_list.map(w => `\\b${w}(ed)?(s)?\\b`).join("|"), "i");
    }

    score(headline: string) {
        if (!this.powerword_list.length) return {
            name: "Powerwords",
            score: 0,
            message: `No Powerwords set - please set some Powerwords in the <a href="/wp-admin/admin.php?page=headlineengine">settings page</a>`,
            pass: false
        };
        const title = headline.toLowerCase().replace(/[^a-z]/gm, " ");
        // Quick compare first
        let found = false;
        let powerwords_found = [];
        for (let word of this.powerword_list) {
            if (title.includes(word)) {
                found = true;
                powerwords_found.push(word);
            }
        }
        if (!found) return {
            name: "Powerwords",
            score: 0,
            message: `No Powerwords found`,
            pass: false
        }
        // const powerwords_found = (title.match(this.powerword_regex) || []).filter(p => (p));
        const score = powerwords_found.length ? 1 : 0;
        const message = powerwords_found.length ? powerwords_found.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(", ") : "None";
        return { name: "Powerwords", score, message, pass: powerwords_found.length > 0 };
    }
}