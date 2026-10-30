/* items.js — the 13 food groups. Array order is the canonical order used everywhere:
   tile grid, stored arrays, CSV columns, charts and legends. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});

  FT.ITEMS = [
    { id: 'milk',           name: 'Milk',           icon: 'milk',      color: '#3F7CB0' },
    { id: 'yogurt',         name: 'Yogurt',         icon: 'yogurt',    color: '#8661B8' },
    { id: 'vegetables',     name: 'Vegetables',     icon: 'carrot',    color: '#2E8B3A' },
    { id: 'fruit',          name: 'Fruit',          icon: 'apple',     color: '#CC3F3F' },
    { id: 'red_meat',       name: 'Red Meat',       icon: 'beef',      color: '#7A2430' },
    { id: 'chicken',        name: 'Chicken',        icon: 'drumstick', color: '#C77A1E' },
    { id: 'chicken_wings',  name: 'Chicken Wings',  icon: 'wing',      color: '#A9472A' },
    { id: 'fish',           name: 'Fish',           icon: 'fish',      color: '#1F8496' },
    { id: 'beans',          name: 'Beans',          icon: 'bean',      color: '#7E6236' },
    { id: 'sugar',          name: 'Sugar',          icon: 'candy',     color: '#D0518A' },
    { id: 'bread',          name: 'Bread',          icon: 'bread',     color: '#A8861A' },
    { id: 'complex_carbs',  name: 'Complex Carbs',  icon: 'wheat',     color: '#5F7F1F' },
    { id: 'processed_food', name: 'Processed Food', icon: 'package',   color: '#5E6672' }
  ];

  FT.ITEM_IDS = FT.ITEMS.map(function (it) { return it.id; });

  var BY_ID = Object.create(null);
  FT.ITEMS.forEach(function (it, i) { it.index = i; BY_ID[it.id] = it; });

  FT.itemById = function (id) { return BY_ID[id] || null; };

  FT.itemName = function (id) { var it = BY_ID[id]; return it ? it.name : id; };

  /* Aliases let older saves and hand-written imports still load. */
  var ALIASES = {
    processed: 'processed_food',
    processed_foods: 'processed_food',
    vegetable: 'vegetables',
    veggies: 'vegetables',
    veggie: 'vegetables',
    bean: 'beans',
    meat: 'red_meat',
    beef: 'red_meat',
    wings: 'chicken_wings',
    wing: 'chicken_wings',
    simple_carbs: 'bread',
    simple_carb: 'bread',
    complex_carb: 'complex_carbs',
    fruits: 'fruit',
    breads: 'bread',
    yoghurt: 'yogurt',
    sugars: 'sugar'
  };

  /* A name or id in, a stored id out (or null). "Red Meat", "red-meat", "RED MEAT" -> red_meat. */
  FT.normalizeItem = function (value) {
    if (value == null) return null;
    var slug = String(value).toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug) return null;
    if (BY_ID[slug]) return slug;
    if (ALIASES[slug]) return ALIASES[slug];
    return null;
  };

  FT.ITEM_ALIASES = ALIASES;
})();
