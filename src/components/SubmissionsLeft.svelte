<script>
    // DEPRECATED!
    
    export let submissions_left;
</script>

<div id="summaryEngineCounter">
    <span id="summaryEngineSubmissionsLeft" class:zero={submissions_left === 0}>{ submissions_left === undefined ? "..." : submissions_left }</span>
    <span id="summaryEngineSubmissionsLeftLabel">submissions left</span>
</div>

<style lang="less">
    #summaryEngineCounter {
        margin-left: 1em;
        display: flex;
        flex-direction: column;

        #summaryEngineSubmissionsLeft {
            padding: 8px;
            background-color: #135516;
            color: #fff;
            border-radius: 2px;
            text-align: center;
            font-size: 1.2em;
        }

        #summaryEngineSubmissionsLeft.zero {
            background-color: rgb(132, 39, 39);
        }
    }
</style>