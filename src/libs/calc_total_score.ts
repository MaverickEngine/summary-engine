import LinearScale from "linear-scale";

export default function calc_total_score(curr: number, target: number, range: [number, number]): number {
    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);
    if (curr < min || curr > max) return 0;
    if (curr === target) return 1;
    let local_range;
    let local_curr;
    if (curr < target) {
        local_range = [0, target - min];
        local_curr = curr - min;
    } else {
        local_range = [max - target, 0];
        local_curr = curr - target;
    }
    const scale = LinearScale(local_range, [0, 1]);
    // console.log({curr, target, range, local_range, local_curr, scale: scale(local_curr)});
    return scale(local_curr);
}