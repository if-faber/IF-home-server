(function () {
  const stations = [
    {
      id: "rmf",
      name: "RMF FM",
      shortName: "RMF",
      tone: "rmf",
      icon: "../icons/rmf.png",
      streamUrl: "http://195.150.20.242:8000/rmf_fm"
    },
    {
      id: "eska",
      name: "Eska",
      shortName: "ESK",
      tone: "eska",
      icon: "../icons/eska.png",
      streamUrl: "https://waw.ic.smcdn.pl/2380-1.mp3"
    },
    {
      id: "zet",
      name: "Radio ZET",
      shortName: "ZET",
      tone: "zet",
      icon: "../icons/zet.png",
      streamUrl: "https://hub.radiostream.pl/stream.pls?radio=8400&type=none&app=none&coding=mp3&redirect=true"
    }
  ];

  const els = {
    player: document.getElementById("radioPlayer"),
    grid: document.getElementById("stationGrid"),
    signal: document.getElementById("radioSignal"),
    title: document.getElementById("radioTitle"),
    subtitle: document.getElementById("radioSubtitle"),
    spectrum: document.getElementById("radioSpectrum"),
    toggle: document.getElementById("radioToggle"),
    stop: document.getElementById("radioStop")
  };

  let activeStation = null;

  function renderStations() {
    els.grid.innerHTML = "";

    stations.forEach((station) => {
      const button = document.createElement("button");
      button.className = `station-card station-${station.tone}`;
      button.type = "button";
      button.dataset.station = station.id;
      button.innerHTML = `
        <span class="station-logo" data-fallback="${station.shortName}">
          <img src="${station.icon}" alt="">
        </span>
        <strong>${station.name}</strong>
      `;

      const image = button.querySelector("img");
      image.addEventListener("error", () => {
        const logo = image.closest(".station-logo");
        image.remove();
        logo.classList.add("logo-missing");
        logo.textContent = logo.dataset.fallback;
      });

      button.addEventListener("click", () => selectStation(station));
      els.grid.appendChild(button);
    });
  }

  async function selectStation(station) {
    activeStation = station;
    document.querySelectorAll(".station-card").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.station === station.id);
    });

    els.signal.textContent = "TUNING";
    els.title.textContent = station.name;
    els.subtitle.textContent = "Lacze ze streamem...";
    els.player.src = station.streamUrl;

    await playActive();
  }

  async function playActive() {
    if (!activeStation) {
      selectStation(stations[0]);
      return;
    }

    try {
      await els.player.play();
      els.signal.textContent = "ON AIR";
      els.subtitle.textContent = `Gra: ${activeStation.name}`;
      els.toggle.textContent = "Pauza";
      els.spectrum.classList.add("is-playing");
    } catch (error) {
      console.warn("Radio stream unavailable:", error);
      els.signal.textContent = "ERROR";
      els.subtitle.textContent = "Przegladarka zablokowala odtwarzanie albo stream nie odpowiada.";
      els.toggle.textContent = "Odtworz";
      els.spectrum.classList.remove("is-playing");
    }
  }

  function pauseRadio() {
    els.player.pause();
    els.signal.textContent = activeStation ? "PAUZA" : "STANDBY";
    els.toggle.textContent = "Odtworz";
    els.spectrum.classList.remove("is-playing");
  }

  function stopRadio() {
    els.player.pause();
    els.player.removeAttribute("src");
    els.player.load();
    activeStation = null;
    els.signal.textContent = "STANDBY";
    els.title.textContent = "Wybierz stacje";
    els.subtitle.textContent = "RMF FM, Eska albo Radio ZET";
    els.toggle.textContent = "Odtworz";
    els.spectrum.classList.remove("is-playing");
    document.querySelectorAll(".station-card").forEach((button) => button.classList.remove("is-active"));
  }

  els.toggle.addEventListener("click", () => {
    if (!activeStation || els.player.paused) {
      playActive();
    } else {
      pauseRadio();
    }
  });

  els.stop.addEventListener("click", stopRadio);

  renderStations();
})();
