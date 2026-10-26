// Which reminders to send in this one-minute cron run.
//
// A free Cloudflare Worker may make only ~50 outgoing requests per invocation,
// so a burst of reminders (everyone in a lecture hall has the same start time)
// cannot all go out in a single minute. Rather than deliver the overflow late,
// the planner starts early - but only as early as it must.
//
// Every pending reminder can be sent in a window of runs: from `lookahead`
// minutes before its minute up to its minute. Given all pending demand, the
// latest-possible schedule is found by walking BACKWARD from the last deadline,
// filling each run with up to `capacity` reminders, preferring the ones whose
// windows open latest (reverse earliest-deadline-first). Whatever that schedule
// places in the current run is what has to go out now; everything else can wait.
// Under light load that is simply "the ones due now"; under a burst it starts a
// few minutes early, never later than the requested time while a feasible
// schedule exists, and at full capacity (earliest deadline first) when none does.
//
// minuteCounts: [{minute, n}]  pending reminders grouped by floor(fire_at / 60);
//               minutes at or before nowMinute are overdue/current and count as due now.
// Returns how many to claim this run (0..capacity). The caller claims them
// earliest-deadline-first, which is never worse than any other choice of that many.
export function mustSendNow(minuteCounts, nowMinute, capacity, lookaheadMinutes) {
  const left = new Map();
  let last = 0;
  for (const { minute, n } of minuteCounts) {
    if (!(n > 0)) continue;
    const k = Math.max(0, minute - nowMinute);          // runs from now until its minute
    left.set(k, (left.get(k) || 0) + n);
    if (k > last) last = k;
  }

  let assignedNow = 0;
  for (let t = last; t >= 0; t--) {                      // t = which run, counted from this one
    let room = capacity;
    // Reminders usable in run t have their minute in [t, t + lookahead].
    for (let k = Math.min(last, t + lookaheadMinutes); k >= t && room > 0; k--) {
      const n = left.get(k) || 0;
      if (!n) continue;
      const take = Math.min(n, room);
      left.set(k, n - take);
      room -= take;
      if (t === 0) assignedNow += take;
    }
  }
  return Math.min(assignedNow, capacity);
}
