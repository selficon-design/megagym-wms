/* Εκκίνηση οθόνης: μενού (☰), κλείσιμο με πάτημα έξω, Esc, γλώσσα */
document.documentElement.lang = 'el';
$('#burger').onclick = e => { e.preventDefault(); openNav(); };
$('#scrim').onclick = closeNav;
// στο κινητό, μετά από επιλογή στο μενού κλείνει μόνο του
$('#nav').addEventListener('click', e => { if (e.target.closest('[data-go]') && window.innerWidth < 900) closeNav(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#modal').innerHTML) closeModal(); else if (AI.open) ACT.closeAi(); else closeNav(); } });
