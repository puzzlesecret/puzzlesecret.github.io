(() => {
  const portraits = '/art/keepers/';
  const artifacts = '/art/under-glass/';
  const keepers = [
    {
      id: 'k1', name: 'Esi Mensah', place: 'Cape Coast, Ghana', trade: 'Chartmaker',
      story: 'Esi kept tide tables for the boats that landed below her window. On a perfectly still morning her brass dial fell off its nail. When she picked it up, one more notch had appeared around the rim. She made a rubbing before anyone could polish it away.'
    },
    {
      id: 'k2', name: 'Ren Mori', place: 'Nagasaki, Japan', trade: 'Bookbinder',
      story: 'A customer once brought Ren a book with a thin strip of paper caught in its spine. He eased it out with his bone folder. The little waves on its face meant nothing to him. He mended the torn fold with blue thread and sent it on to a woman who knew the sea.'
    },
    {
      id: 'k3', name: 'Inés Vega', place: 'Valparaíso, Chile', trade: 'Instrument repairer',
      story: 'A walnut case came to Inés with a rattle in its lid. She shook out a brass shaving, curled like a fingernail. It fitted the fresh cut on Esi’s dial. Inés wrapped the shaving in felt. The next morning the case rattled again.'
    },
    {
      id: 'k4', name: 'Yusuf Idrissi', place: 'Fez, Morocco', trade: 'Brassworker',
      story: 'Yusuf sharpened every tool in his shop himself. He could tell which file had cut each of the seven old notches on the dial. The eighth had no file marks at all. He kept it unpolished, wrapped in the sleeve of his best shirt.'
    },
    {
      id: 'k5', name: 'Elín Jónsdóttir', place: 'Reykjavík, Iceland', trade: 'Printer',
      story: 'Elín ran the paper strip through her press to copy its little waves. The copy came out neatly. The original came out longer by one fold. She wrote her initials on the new panel while the ink on the others was still wet.'
    },
    {
      id: 'k6', name: 'Arun Joseph', place: 'Kochi, India', trade: 'Clock repairer',
      story: 'The woman who left the walnut case on Arun’s bench asked him to listen at noon. It gave one quiet tick. Under the lining he found a round impression beside a much smaller one. He drew both in his repair book and charged her for a new hinge.'
    },
    {
      id: 'k7', name: 'Mariam Nassar', place: 'Alexandria, Egypt', trade: 'Draughtswoman',
      story: 'Mariam measured this room with a length of knotted cord. Her plan shows seven places for portraits. Beside the last she pencilled a small circle and rubbed it out again. You can still feel where the point of her dividers went through the paper.'
    }
  ].map(keeper => ({
    ...keeper,
    image: portraits + keeper.id + '.webp',
    alt: 'Painted portrait of ' + keeper.name + ', the ' + keeper.trade.toLowerCase() + ' from ' + keeper.place + '.'
  }));

  const objects = [
    {
      id: 'disc', name: 'Brass tide dial',
      front: 'The rim fits in your palm. Seven cuts have gone dark with age. Beside them is a bright eighth cut, narrow enough to catch a thread.',
      back: 'A wave is scratched into the brass. A blue thread clings to the rivet. Someone folded a paper strip against this face while the ink was wet.',
      alt: 'A worn brass dial with a fine pointer, seven engraved notches and one bright cut.',
      reverseAlt: 'The back of the dial bears a wave and a scrap of blue thread caught under its rivet.'
    },
    {
      id: 'strip', name: 'Folded tide strip',
      front: 'The folds open across your hand. Waves run from panel to panel until they reach a repair sewn in blue. The last panel is almost clean.',
      back: 'Hold the strip the other way up. There are eight thumbprints, one on each panel. On the newest, Elín has written two tiny letters in the dip of the whorl.',
      alt: 'An accordion-folded paper strip printed with waves and repaired with blue stitching.',
      reverseAlt: 'Eight faint inked thumbprints run across the reverse. The last carries the initials E. J.'
    },
    {
      id: 'box', name: 'Walnut instrument case',
      front: 'The case is light. A tiny crescent of brass rolls from end to end when you tilt it. The catch gives under your thumb.',
      back: 'Two hollows in the felt. The large one would take the tide dial exactly. The small one has the polished outline of a key no longer here.',
      alt: 'A small walnut case seen from above, with a brass clasp and repaired hinge.',
      reverseAlt: 'Inside the open case, dark green felt holds a round impression, a narrow key-shaped hollow and a curled brass shaving.'
    }
  ].map(object => ({
    ...object,
    image: artifacts + object.id + '.svg',
    reverseImage: artifacts + object.id + '-reverse.svg'
  }));
  window.PSCellarCatalog = Object.freeze({ keepers, objects });
})();
