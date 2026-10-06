/* Lightbox for the presentation template (templates/presentation), put into
   the document by scripts/build-presentation.mjs. Click a picture to view it
   full screen, then move within the room: the pictures sit side by side in a
   strip the browser scrolls and snaps natively, so a finger drags the picture
   and the next one slides in. Without JS (or without <dialog>) every picture
   is already on the page. No links: the viewer never navigates away. */
(function () {
  var doc = document
  var root = doc.documentElement
  root.classList.remove("no-js")
  var lb = doc.querySelector("dialog.lb")
  if (!lb || typeof lb.showModal !== "function") return
  root.classList.add("js")

  var track = lb.querySelector(".lb-track")
  var cap = lb.querySelector(".lb-cap")
  var count = lb.querySelector(".lb-count")
  var roomName = lb.querySelector(".lb-room")
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  var list = []
  var pos = 0
  var opener = null

  function captionOf(fig) {
    var parts = fig.querySelectorAll("figcaption > span")
    return Array.prototype.map.call(parts, function (s) { return s.textContent }).join(" · ")
  }

  function label(i) {
    pos = i
    cap.textContent = captionOf(list[i])
    count.textContent = i + 1 + " / " + list.length
  }

  // Move to slide i; past either end wraps around with a jump, not a long slide.
  function go(i, smooth) {
    var wrap = i < 0 || i >= list.length
    i = (i + list.length) % list.length
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !wrap && !reduce ? "smooth" : "auto" })
    label(i)
  }

  function open(fig) {
    var room = fig.closest(".room")
    list = Array.prototype.slice.call(room.querySelectorAll("figure.shot"))
    roomName.textContent = room.dataset.name || room.querySelector("h2").textContent
    opener = fig.querySelector(".zoom")
    // One slide per picture, reusing the page's data: URI strings (no bytes copied into the file).
    track.innerHTML = ""
    list.forEach(function (f) {
      var src = f.querySelector("img")
      var slide = doc.createElement("div")
      slide.className = "lb-slide"
      var img = doc.createElement("img")
      img.src = src.currentSrc || src.src
      img.alt = src.alt
      img.width = src.getAttribute("width")
      img.height = src.getAttribute("height")
      img.decoding = "async"
      img.draggable = false
      // Markloop: this picture mirrors the one on the page. A comment made here
      // lands on the page picture, and that picture's pins show here too.
      if (f.id) img.setAttribute("data-markloop-mirror", "#" + CSS.escape(f.id) + " img")
      slide.appendChild(img)
      track.appendChild(slide)
    })
    lb.showModal()
    go(list.indexOf(fig), false)
    lb.querySelector(".lb-close").focus()
  }

  doc.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".zoom")
    if (btn) open(btn.closest("figure"))
  })

  // The counter and caption follow the picture that settles in the middle,
  // whether it got there by a finger, a button or a key.
  var settle = null
  track.addEventListener("scroll", function () {
    clearTimeout(settle)
    settle = setTimeout(function () {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
      if (i !== pos && list[i]) label(i)
    }, 60)
  }, { passive: true })

  // Keep the current picture centered when the window turns or resizes.
  window.addEventListener("resize", function () {
    if (lb.open) track.scrollTo({ left: pos * track.clientWidth, behavior: "auto" })
  })

  // Every close path (button, empty area, Esc, comment mode without mirror
  // support) ends here once:
  // drop the slides and put focus back on the picture that opened it.
  function restore() {
    if (!opener) return
    var o = opener
    opener = null
    track.innerHTML = ""
    o.focus()
  }
  function closeLb() {
    if (lb.open) lb.close()
    restore()
  }

  lb.querySelector(".lb-close").addEventListener("click", closeLb)
  lb.querySelector(".lb-prev").addEventListener("click", function () { go(pos - 1, true) })
  lb.querySelector(".lb-next").addEventListener("click", function () { go(pos + 1, true) })
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(pos - 1, true) }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(pos + 1, true) }
  })
  lb.addEventListener("close", restore) // Esc

  // A tap on the empty area around a picture closes.
  track.addEventListener("click", function (e) {
    if (e.target.classList.contains("lb-slide")) closeLb()
  })

  // Markloop: comment mode (body.gc-mode) works inside the viewer when the
  // comment layer understands mirrors (<html data-markloop-review="mirror">).
  // Otherwise close the viewer, so the comment lands on the picture in the page
  // and not on the temporary viewer.
  function mirrorsSupported() {
    return /(^|\s)mirror(\s|$)/.test(root.getAttribute("data-markloop-review") || "")
  }
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (lb.open && doc.body.classList.contains("gc-mode") && !mirrorsSupported()) closeLb()
    }).observe(doc.body, { attributes: true, attributeFilter: ["class"] })
  }
})()
