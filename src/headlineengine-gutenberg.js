import "./headlineengine-gutenberg.scss";
import Calc_Score from "./headlineengine-score.ts";
import LinearScale from "linear-scale";

let editor_type = "gututenberg";

async function main() {
    const calc_score = new Calc_Score();
    async function display_analysis(container, title_descriptor) {
        let title;
        if (editor_type === "classic") {
            title = jQuery(title_descriptor).val();
        } else {
            title = jQuery(title_descriptor).first().text();
        }
        if (!title || !title.trim().length) {
            container.html("");
            return false;
        }
        const scores = await calc_score.score(title);
        let colour_grey = [179, 179, 179];
        let colour_green = [31, 120, 31];
        let rscale = LinearScale([0, 1], [colour_grey[0], colour_green[0]]);
        let gscale = LinearScale([0, 1], [colour_grey[1], colour_green[1]]);
        let bscale = LinearScale([0, 1], [colour_grey[2], colour_green[2]]);
        let colour = [rscale(scores.total_score), gscale(scores.total_score), bscale(scores.total_score)];
        const score_el = jQuery(`
        <div class='headlineengine-score' style="background-color: rgba(${ colour.join(", ")}, 0.6)">
            <div class='headlineengine-score-value'>${ Math.floor(scores.total_score * 100) }<div class='headlineengine-divisor'>100</div></div>
            <div class='headlineengine-score-title'>HeadlineEngine<br>Score</div>
        </div>`);
        container.html(score_el);
        const score_analisys_container = jQuery(`<div class="headlineengine-analysis"></div>`);
        for (let score of scores.scores) {
            const score_el = jQuery(`<div>${score.name}: ${score.message}</div>`);
            score_analisys_container.append(score_el);
        }
        container.append(score_analisys_container);
        // const analysis = jQuery(`<div class="headlineengine-analysis">
        //     <div class="headlineengine-analysis-readability">Readability: ${score.readability.message} (${Math.round(score.readability.ease_score)})</div>
        //     <div class="headlineengine-analysis-length">Length: ${score.length.message} (${score.length.length})</div>
        //     <div class="headlineengine-analysis-powerwords">Powerwords: ${(score.powerwords.words.length) ? score.powerwords.words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(", ") : "None" }</div>
        // </div>`);
        
        // container.append(analysis);
        return true;
    }
    jQuery(async () => {
        await calc_score.init();
        if (jQuery("#titlewrap").length) {
            editor_type = "classic";
        }
        // wait for title_descriptor to be loaded
        let title_descriptor = ".editor-post-title__input";
        let titlewrap_descriptor = ".edit-post-visual-editor__post-title-wrapper";
        if (editor_type === "classic") { // Looks like classic editor
            title_descriptor = "#title";
            titlewrap_descriptor = "#titlewrap";
        }
        if (!jQuery(title_descriptor)) {
            console.log("Could not find title descriptor");
            return; // Could not find title element
        }
        let title_descriptor_el = jQuery(title_descriptor);
        while (!title_descriptor_el.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
            title_descriptor_el = jQuery(title_descriptor);
        }
        const titlewrap_el = jQuery(titlewrap_descriptor);
        const headline_score_container_el = jQuery("<div id='headlineengine-score-container'></div>");
        titlewrap_el.after(headline_score_container_el);
        headline_score_container_el.hide();
        if (await display_analysis(headline_score_container_el, title_descriptor)) {
            headline_score_container_el.slideDown();
        };
        let timer;
        title_descriptor_el.on("keypress", async function(e) {
            if (timer) clearTimeout(timer);
            // If key is space
            if (e.key === " ") {
                await display_analysis(headline_score_container_el, title_descriptor);
                return;
            }
            timer = setTimeout(async () => {
                await display_analysis(headline_score_container_el, title_descriptor);
                headline_score_container_el.slideDown();
            }, 500);
        })
        title_descriptor_el.on("focus", async function() {
            headline_score_container_el.stop().stop();
            await display_analysis(headline_score_container_el, title_descriptor);
            headline_score_container_el.slideDown();
        })
        const can_hide = function() {
            return !jQuery(":focus").is(title_descriptor_el) && !jQuery(":hover").is(headline_score_container_el);
        };
        title_descriptor_el.on("blur", function() {
            if (can_hide()) {
                headline_score_container_el.delay(1000).slideUp();
            }
        })
        headline_score_container_el.on("mouseout", function() {
            if (can_hide()) {
                headline_score_container_el.delay(1000).slideUp();
            }
        })
        // await display_analysis(headline_score_container_el, title_descriptor);
    });
}

main();