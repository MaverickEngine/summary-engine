<script>
    import * as Pancake from '@sveltejs/pancake';
    import { format as date_format, max as date_max, min as date_min, addDays, intervalToDuration } from 'date-fns';

    const format_date = date => date_format(date, 'yyyy-MM-dd');

    export let data = {
        "2022-01-01": {
            "good": 5,
            "bad": 20,
            "unrated": 53
        },
        "2022-01-02": {
            "good": 85,
            "bad": 12,
            "unrated": 51
        },
        "2022-01-03": {
            "good": 65,
            "bad": 9,
            "unrated": 59
        },
        "2022-01-06": {
            "good": 35,
            "bad": 14,
            "unrated": 34
        },
    };

    const colors = ['#00bbff', '#8bcef6', '#c4e2ed']

    const days = Object.keys(data);
    const keys = Object.keys(data[days[0]]);
    const tdays = days.map(date => new Date(date));
    // Fill missing days
   
    const first_day = date_min(tdays);
    const last_day = date_max(tdays);
    const duration = intervalToDuration({ start: first_day, end: last_day }).days + 1;
    for (let i = 0; i < duration; i++) {
        const day = format_date(addDays(first_day, i));
        console.log(day);
        if (!data[day]) {
            const empty_day = {};
            keys.forEach(key => empty_day[key] = 0);
            data[day] = Object.assign(empty_day);
        }
    }
    console.log({data});
    const flat_data = [];
    const complete_days = Object.keys(data).sort();
    let index = 0;
    for (let day of complete_days) {
        flat_data.push(Object.assign(data[day], { index, day }));
        index++;
    }
    console.log({flat_data});

    const stacks = Pancake.stacks(flat_data, keys, "index");
    console.log(stacks);
    const max = stacks.reduce((max, stack) => Math.max(max, ...stack.values.map(v => v.end)), 0);
    console.log({max, first_day, last_day});
</script>

<div class="chart">
    <Pancake.Chart y1={0} y2={max} x1={0} x2={flat_data.length - 1}>
		<Pancake.Grid horizontal count={5} let:value let:first>
			<div class="grid-line horizontal"><span>{value}</span></div>
		</Pancake.Grid>

		<Pancake.Grid vertical count={data.length} let:value>
			<div class="grid-line vertical"></div>
			<span class="x-label">{complete_days[value]}</span>
		</Pancake.Grid>

		{#each stacks as stack, i}
			{#each stack.values as d}
            <Pancake.Box
                x1="{d.i + 0.1}"
                x2="{d.i + 0.9 }"
                y1="{d.start}"
                y2="{d.end}"
            >
					<div class="box" style="background-color: {colors[i]}"></div>
				</Pancake.Box>
			{/each}
		{/each}
	</Pancake.Chart>
</div>

<style lang="scss">
    .chart {
		height: 200px;
		padding: 3em 0 2em 3em;
		margin: 0 0 36px 0;
        width: 600px;
	}

	.grid-line {
		position: relative;
		display: block;
	}

	.grid-line.horizontal {
		width: 100%;
		left: -3em;
        text-align: right;
        span {
            width: 2em;
        }
        // border-bottom: 1px solid #ccc;
	}

	.grid-line.vertical {
		height: 100%;
		border-left: 1px dashed #ccc;
	}

	.grid-line span {
		position: absolute;
		left: 0;
		bottom: -0.5em;
		font-family: sans-serif;
		font-size: 14px;
		color: #999;
		line-height: 1;
	}

	.x-label {
		position: absolute;
		width: 6em;
		// left: -2em;
		bottom: -22px;
		font-family: sans-serif;
		font-size: 14px;
		color: #999;
		text-align: center;
	}

	.box {
		position: absolute;
		left: 0;
		top: 2px;
		width: 100%;
		height: calc(100% - 4px);
		border-radius: 2px;
	}
</style>