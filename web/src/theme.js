/* θέμα: μέρα / νύχτα (αποθηκεύεται στη συσκευή) */
(function () { try { const t = localStorage.getItem('mg-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {} })();
