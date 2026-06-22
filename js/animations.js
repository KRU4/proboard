const Animations = (() => {
  let previousData = [];

  function detectRankChanges(prev, curr) {
    const prevMap = new Map();
    prev.forEach(e => prevMap.set(e.name, e.rank));

    const movedUp = [];
    const movedDown = [];
    const unchanged = [];

    curr.forEach(e => {
      const oldRank = prevMap.get(e.name);
      if (oldRank === undefined) {
        movedUp.push(e.name);
      } else if (e.rank < oldRank) {
        movedUp.push(e.name);
      } else if (e.rank > oldRank) {
        movedDown.push(e.name);
      } else {
        unchanged.push(e.name);
      }
    });

    return { movedUp, movedDown, unchanged };
  }

  function applyRankAnimations(changes) {
    const cards = document.querySelectorAll('[data-employee-name]');
    cards.forEach(card => {
      const name = card.getAttribute('data-employee-name');
      card.classList.remove('rank-up', 'rank-down');

      if (changes.movedUp.includes(name)) {
        card.classList.add('rank-up');
      } else if (changes.movedDown.includes(name)) {
        card.classList.add('rank-down');
      }
    });

    setTimeout(() => {
      cards.forEach(card => {
        card.classList.remove('rank-up', 'rank-down');
      });
    }, 1600);
  }

  function getPrevious() {
    return previousData;
  }

  function setPrevious(data) {
    previousData = [...data];
  }

  return { detectRankChanges, applyRankAnimations, getPrevious, setPrevious };
})();
