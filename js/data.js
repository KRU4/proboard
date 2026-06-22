const DataService = (() => {
  let cachedEmployees = [];

  function parseCsv(rawText) {
    const lines = rawText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const nameIdx = headers.indexOf('name');
    const scoreIdx = headers.indexOf('score');
    const avatarIdx = headers.indexOf('avatar');
    const deptIdx = headers.indexOf('department');

    if (nameIdx === -1 || scoreIdx === -1) {
      console.error('CSV must have Name and Score columns');
      return [];
    }

    const employees = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 2 || !cols[nameIdx]) continue;

      const employee = {
        name: cols[nameIdx],
        score: parseInt(cols[scoreIdx], 10) || 0,
        avatar: avatarIdx !== -1 ? (cols[avatarIdx] || '') : '',
        department: deptIdx !== -1 ? (cols[deptIdx] || '') : '',
      };

      employees.push(employee);
    }

    return employees;
  }

  function sortByScore(employees) {
    return [...employees].sort((a, b) => b.score - a.score);
  }

  function assignRanks(employees) {
    return employees.map((emp, idx) => ({
      ...emp,
      rank: idx + 1,
    }));
  }

  async function fetchGoogleSheet() {
    const res = await fetch(CONFIG.googleSheetCsvUrl);
    const text = await res.text();
    return text;
  }

  async function fetchLocalCsv() {
    const res = await fetch(CONFIG.localCsvPath);
    const text = await res.text();
    return text;
  }

  function fetchFromStorage() {
    const raw = localStorage.getItem('proboard_data');
    if (!raw) return [];
    return JSON.parse(raw);
  }

  async function fetchData() {
    let employees = [];

    switch (CONFIG.mode) {
      case 'google_sheet': {
        const csvText = await fetchGoogleSheet();
        employees = parseCsv(csvText);
        break;
      }
      case 'local_csv': {
        const csvText = await fetchLocalCsv();
        employees = parseCsv(csvText);
        break;
      }
      case 'admin_panel': {
        employees = fetchFromStorage();
        break;
      }
      default: {
        console.error('Unknown mode:', CONFIG.mode);
        return [];
      }
    }

    const sorted = sortByScore(employees);
    const ranked = assignRanks(sorted);
    return ranked;
  }

  function getCached() {
    return cachedEmployees;
  }

  function setCached(employees) {
    cachedEmployees = employees;
  }

  return { fetchData, parseCsv, sortByScore, getCached, setCached };
})();
