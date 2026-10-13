/* NaijaTaste landing — pure vanilla JS. No libraries, no tracking. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Sticky nav state (passive scroll listener — no layout thrash) */
  var nav = document.getElementById('nav');
  var ticking = false;
  var onScroll = function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      nav.classList.toggle('scrolled', window.scrollY > 24);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 2. Scroll reveals — one IntersectionObserver, unobserve after reveal */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* 3. Animated counters (ease-out cubic, once each) */
  var runCounter = function (el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }
    var start = null;
    var dur = 1200;
    var tick = function (t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* 4. Cuisine ticker — content duplicated once for a seamless -50% loop */
  var dishes = [
    ['Amala & Ewedu', 'Yoruba'], ['Suya', 'Street Food'], ['Jollof Rice', 'Party'],
    ['Pepper Soup', 'Igbo'], ['Banga Soup', 'Delta'], ['Kilishi', 'Hausa'],
    ['Nkwobi', 'Nightlife'], ['Ofada Rice', 'Local'], ['Asun', 'Hot'],
  ];
  var track = document.getElementById('tickerTrack');
  if (track) {
    var html = dishes.map(function (d) {
      return '<span><b>' + d[0] + '</b> · ' + d[1] + '</span>';
    }).join('');
    track.innerHTML = html + html;
  }

  /* 5. Hero demo chat — scripted loop, pauses when tab hidden */
  var script = [
    { who: 'user', text: 'Student in Yaba. Love pepper soup. Budget is tight.' },
    { who: 'bot', text: 'Got it — extra-hot, budget-friendly, Yaba. Scanning 12 spots…', tool: 'search_restaurants' },
    { who: 'bot', text: 'Top pick: Amala Spot Yaba — 94% match, full pepper soup under ₦2k.', tool: 'get_recommendations' },
    { who: 'bot', text: 'Saved: extra-hot + budget. Hotter picks first next time.', tool: 'save_preference' },
  ];
  var chat = document.getElementById('demoChat');
  var renderStatic = function () {
    chat.innerHTML = script.map(function (m) {
      return '<div class="bubble ' + m.who + '">' + m.text +
        (m.tool ? '<br /><span class="tool">' + m.tool + '</span>' : '') + '</div>';
    }).join('');
  };
  if (chat) {
    if (reduceMotion) {
      renderStatic();
    } else {
      var i = 0;
      var step = function () {
        if (document.hidden) {
          setTimeout(step, 1500);
          return;
        }
        if (i >= script.length) {
          setTimeout(function () { chat.innerHTML = ''; i = 0; step(); }, 2600);
          return;
        }
        var m = script[i];
        var div = document.createElement('div');
        div.className = 'bubble ' + m.who;
        div.textContent = m.text;
        if (m.tool) {
          div.appendChild(document.createElement('br'));
          var chip = document.createElement('span');
          chip.className = 'tool';
          chip.textContent = m.tool;
          div.appendChild(chip);
        }
        chat.appendChild(div);
        i += 1;
        setTimeout(step, m.who === 'user' ? 1400 : 1900);
      };
      setTimeout(step, 900);
    }
  }

  /* 6. FAQ accordion — one open at a time */
  document.querySelectorAll('.faq details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      document.querySelectorAll('.faq details').forEach(function (other) {
        if (other !== d && other.open) other.removeAttribute('open');
      });
    });
  });
})();
