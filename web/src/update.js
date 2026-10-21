/* Νέα έκδοση: όταν ανεβεί νέα έκδοση, η ανοιχτή εφαρμογή το καταλαβαίνει και ανανεώνεται
   (κατά την επιστροφή στην εφαρμογή, αν δεν υπάρχει ανοιχτή φόρμα με δεδομένα). */
(function () {
  async function check() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = (await r.json()).build;
      if (v && typeof APP_BUILD !== 'undefined' && v !== APP_BUILD) {
        const busy = (S.form && S.form.cart && Object.keys(S.form.cart).length) || $('#modal').innerHTML;
        if (!busy) location.reload();
        else if (!check.told) { check.told = true; toast('Υπάρχει νέα έκδοση της εφαρμογής. Θα ενημερωθεί μόλις ολοκληρώσετε την τρέχουσα εργασία.'); }
      }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 5 * 60 * 1000);
})();
