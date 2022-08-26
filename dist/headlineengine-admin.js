(function () {
    'use strict';

    jQuery("#headlineengine_load_powerwords").on("click", async function() {
        const powerword_list = await (await fetch(headlineengine_powerwords_url)).text();
        jQuery("#headlineengine_powerwords_list").val(powerword_list);
    });

})();
//# sourceMappingURL=headlineengine-admin.js.map
