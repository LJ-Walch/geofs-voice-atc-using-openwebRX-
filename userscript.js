// ==UserScript==
// @name         GeoFS Simple Voice Chat
// @namespace    geofs.voice
// @version      1.0
// @description  Simple GeoFS multiplayer voice chat using LiveKit
// @match        https://www.geo-fs.com/*
// @match        https://geo-fs.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    /*
     * =========================================================
     *                  ONLY CHANGE THIS
     * =========================================================
     *
     * Put your LiveKit Development Token Server ID here.
     *
     * Example:
     *
     * token-server-123456
     *
     */

    const TOKEN_SERVER_ID = "webrxgeofs-1u9feg";


    /*
     * =========================================================
     * SETTINGS
     * =========================================================
     */

    const ROOM_NAME = "geofs-main";

    const PTT_KEY = "CapsLock";

    const DEFAULT_FREQUENCY = 122.800;

    const MAX_DISTANCE_KM = 150;

    const SDK_URL =
        "https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js";


    /*
     * =========================================================
     * STATE
     * =========================================================
     */

    let livekit = null;

    let room = null;

    let microphoneTrack = null;

    let connected = false;

    let transmitting = false;

    let frequency = DEFAULT_FREQUENCY;

    let volume = 1.0;

    let muted = false;

    let players = {};

    let remoteAudio = {};

    let ownPosition = null;


    /*
     * =========================================================
     * LOAD LIVEKIT
     * =========================================================
     */

    function loadLiveKit() {

        return new Promise(function (resolve, reject) {

            if (window.LivekitClient) {

                livekit =
                    window.LivekitClient;

                resolve();

                return;
            }


            const script =
                document.createElement("script");

            script.src = SDK_URL;

            script.onload = function () {

                if (!window.LivekitClient) {

                    reject(
                        new Error(
                            "LiveKit SDK loaded but was not found."
                        )
                    );

                    return;
                }

                livekit =
                    window.LivekitClient;

                resolve();

            };


            script.onerror = function () {

                reject(
                    new Error(
                        "Could not load LiveKit."
                    )
                );

            };


            document.head.appendChild(script);

        });

    }


    /*
     * =========================================================
     * UI
     * =========================================================
     */

    function createUI() {

        if (
            document.getElementById(
                "geofs-voice-panel"
            )
        ) {

            return;

        }


        const panel =
            document.createElement("div");

        panel.id =
            "geofs-voice-panel";


        panel.innerHTML = `

            <div id="gvc-title">

                GeoFS VOICE

                <span id="gvc-status">
                    OFFLINE
                </span>

            </div>


            <button id="gvc-connect">
                CONNECT
            </button>


            <div class="gvc-section">

                <label>
                    Frequency
                </label>

                <input
                    id="gvc-frequency"
                    type="number"
                    min="118"
                    max="136.975"
                    step="0.005"
                    value="122.800"
                >

            </div>


            <div class="gvc-section">

                <label>
                    Volume
                </label>

                <input
                    id="gvc-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value="1"
                >

            </div>


            <div class="gvc-indicators">

                <span id="gvc-tx">
                    TX
                </span>

                <span id="gvc-rx">
                    RX
                </span>

            </div>


            <div id="gvc-frequency-display">
                122.800
            </div>


            <div id="gvc-players">
                No players
            </div>


            <div id="gvc-help">
                q = PUSH TO TALK
            </div>

        `;


        document.body.appendChild(panel);


        const style =
            document.createElement("style");


        style.textContent = `

            #geofs-voice-panel {

                position: fixed;

                top: 100px;

                right: 20px;

                width: 240px;

                padding: 12px;

                background:
                    rgba(15,15,18,0.96);

                color: white;

                font-family:
                    Arial,
                    sans-serif;

                font-size: 12px;

                border:
                    1px solid #555;

                border-radius:
                    8px;

                z-index:
                    999999;

                box-shadow:
                    0 6px 25px
                    rgba(0,0,0,0.5);

            }


            #gvc-title {

                font-size: 16px;

                font-weight: bold;

                margin-bottom: 10px;

                display: flex;

                justify-content:
                    space-between;

            }


            #gvc-status {

                font-size: 9px;

                opacity: 0.7;

            }


            #gvc-connect {

                width: 100%;

                padding: 7px;

                margin-bottom: 10px;

                cursor: pointer;

            }


            .gvc-section {

                margin-bottom: 10px;

            }


            .gvc-section label {

                display: block;

                margin-bottom: 4px;

            }


            #gvc-frequency {

                width: 100%;

                box-sizing:
                    border-box;

                background: #111;

                color: white;

                border:
                    1px solid #555;

                padding: 5px;

            }


            #gvc-volume {

                width: 100%;

            }


            .gvc-indicators {

                display: flex;

                gap: 8px;

                margin-top: 8px;

            }


            .gvc-indicators span {

                padding:
                    4px 10px;

                background:
                    #222;

                border-radius:
                    4px;

            }


            #gvc-frequency-display {

                text-align:
                    center;

                font-size: 20px;

                font-weight: bold;

                margin-top: 10px;

                padding: 8px;

                background:
                    #090909;

                border-radius:
                    5px;

            }


            #gvc-players {

                margin-top: 10px;

                max-height: 100px;

                overflow-y: auto;

                background:
                    #111;

                padding: 6px;

                border-radius:
                    4px;

            }


            #gvc-help {

                margin-top: 8px;

                text-align: center;

                font-size: 9px;

                opacity: 0.6;

            }

        `;


        document.head.appendChild(style);


        /*
         * CONNECT
         */

        document
            .getElementById(
                "gvc-connect"
            )
            .addEventListener(
                "click",
                connectVoice
            );


        /*
         * FREQUENCY
         */

        document
            .getElementById(
                "gvc-frequency"
            )
            .addEventListener(
                "change",
                function () {

                    let value =
                        Number(this.value);


                    if (
                        !isFinite(value)
                    ) {

                        value =
                            DEFAULT_FREQUENCY;

                    }


                    value =
                        Math.max(
                            118,
                            Math.min(
                                136.975,
                                value
                            )
                        );


                    frequency =
                        Math.round(
                            value * 1000
                        ) / 1000;


                    this.value =
                        frequency.toFixed(3);


                    updateFrequencyDisplay();

                    sendRadioState();

                }
            );


        /*
         * VOLUME
         */

        document
            .getElementById(
                "gvc-volume"
            )
            .addEventListener(
                "input",
                function () {

                    volume =
                        Number(
                            this.value
                        );

                    updateRemoteVolumes();

                }
            );

    }


    /*
     * =========================================================
     * STATUS
     * =========================================================
     */

    function setStatus(text) {

        const element =
            document.getElementById(
                "gvc-status"
            );

        if (element) {

            element.textContent =
                text;

        }

    }


    function updateFrequencyDisplay() {

        const element =
            document.getElementById(
                "gvc-frequency-display"
            );

        if (element) {

            element.textContent =
                frequency.toFixed(3);

        }

    }


    /*
     * =========================================================
     * CONNECT TO LIVEKIT
     * =========================================================
     */

    async function connectVoice() {

        if (connected) {

            disconnectVoice();

            return;

        }


        if (
            !TOKEN_SERVER_ID ||
            TOKEN_SERVER_ID ===
                "PUT-YOUR-TOKEN-SERVER-ID-HERE"
        ) {

            alert(
                "Enter your LiveKit Development Token Server ID in the script first."
            );

            return;

        }


        try {

            setStatus(
                "LOADING"
            );


            await loadLiveKit();


            /*
             * LiveKit's development token source
             * automatically requests the room
             * connection credentials.
             */

            const tokenSource =
                livekit.TokenSource
                    .developmentTokenServer(
                        TOKEN_SERVER_ID
                    );


            /*
             * Give each player a random identity.
             */

            const identity =
                "GeoFS-" +
                Math.random()
                    .toString(36)
                    .substring(2, 8);


            const credentials =
                await tokenSource.fetch({

                    roomName:
                        ROOM_NAME,

                    participantIdentity:
                        identity

                });


            room =
                new livekit.Room();


            /*
             * Remote audio.
             */

            room.on(
                livekit.RoomEvent.TrackSubscribed,
                function (
                    track,
                    publication,
                    participant
                ) {

                    if (
                        track.kind !==
                        livekit.Track.Kind.Audio
                    ) {

                        return;

                    }


                    const element =
                        track.attach();


                    element.autoplay =
                        true;

                    element.volume =
                        volume;


                    element.style.display =
                        "none";


                    document.body.appendChild(
                        element
                    );


                    remoteAudio[
                        participant.identity
                    ] = {

                        element:
                            element,

                        participant:
                            participant,

                        track:
                            track

                    };


                    updateRemoteVolumes();

                    updatePlayerList();

                }
            );


            /*
             * Remote audio removed.
             */

            room.on(
                livekit.RoomEvent.TrackUnsubscribed,
                function (
                    track,
                    publication,
                    participant
                ) {

                    track.detach();


                    delete remoteAudio[
                        participant.identity
                    ];


                    delete players[
                        participant.identity
                    ];


                    updatePlayerList();

                }
            );


            /*
             * Player joined.
             */

            room.on(
                livekit.RoomEvent.ParticipantConnected,
                function (
                    participant
                ) {

                    updatePlayerList();

                }
            );


            /*
             * Player left.
             */

            room.on(
                livekit.RoomEvent.ParticipantDisconnected,
                function (
                    participant
                ) {

                    delete players[
                        participant.identity
                    ];


                    if (
                        remoteAudio[
                            participant.identity
                        ]
                    ) {

                        delete remoteAudio[
                            participant.identity
                        ];

                    }


                    updatePlayerList();

                }
            );


            /*
             * Connect.
             */

            await room.connect(
                credentials.serverUrl,
                credentials.participantToken
            );


            connected =
                true;


            setStatus(
                "CONNECTED"
            );


            const button =
                document.getElementById(
                    "gvc-connect"
                );


            button.textContent =
                "DISCONNECT";


            /*
             * Start microphone.
             */

            await enableMicrophone();


            /*
             * Start state sharing.
             */

            startStateSharing();


            updatePlayerList();


        } catch (error) {

            console.error(
                "[GeoFS Voice]",
                error
            );


            setStatus(
                "ERROR"
            );


            alert(
                "GeoFS Voice connection failed.\n\n" +
                error.message
            );

        }

    }


    /*
     * =========================================================
     * MICROPHONE
     * =========================================================
     */

    async function enableMicrophone() {

        if (!room) {

            return;

        }


        try {

            await room.localParticipant
                .setMicrophoneEnabled(
                    false
                );


            setStatus(
                "MIC READY"
            );


        } catch (error) {

            console.error(
                "Microphone error:",
                error
            );


            alert(
                "Microphone access was denied.\n\n" +
                "Allow microphone access in your browser."
            );

        }

    }


    /*
     * =========================================================
     * PUSH TO TALK
     * =========================================================
     */

    async function setPTT(active) {

        if (!room || !connected) {

            return;

        }


        if (
            transmitting ===
            active
        ) {

            return;

        }


        transmitting =
            active;


        try {

            await room.localParticipant
                .setMicrophoneEnabled(
                    active
                );

        } catch (error) {

            console.error(
                "PTT error:",
                error
            );

        }


        updateTX();

        sendRadioState();

    }


    window.addEventListener(
        "keydown",
        function (event) {

            if (
                event.code ===
                PTT_KEY
            ) {

                event.preventDefault();

                setPTT(true);

            }

        }
    );


    window.addEventListener(
        "keyup",
        function (event) {

            if (
                event.code ===
                PTT_KEY
            ) {

                event.preventDefault();

                setPTT(false);

            }

        }
    );


    /*
     * =========================================================
     * RADIO DATA
     * =========================================================
     */

    async function sendRadioState() {

        if (!room) {

            return;

        }


        const data = {

            type:
                "radio",

            frequency:
                frequency,

            transmitting:
                transmitting,

            position:
                ownPosition

        };


        try {

            await room.localParticipant
                .publishData(
                    new TextEncoder().encode(
                        JSON.stringify(data)
                    ),
                    {
                        reliable: true
                    }
                );

        } catch (error) {

            /*
             * Data messaging may not be available
             * until the room is fully connected.
             */

        }

    }


    /*
     * =========================================================
     * GEOFS POSITION
     * =========================================================
     */

    function getGeoFSPosition() {

        try {

            if (
                window.geofs &&
                geofs.aircraft &&
                geofs.aircraft.instance
            ) {

                const aircraft =
                    geofs.aircraft.instance;


                if (
                    aircraft.llaLocation &&
                    aircraft.llaLocation.length >= 2
                ) {

                    return {

                        lat:
                            Number(
                                aircraft
                                    .llaLocation[0]
                            ),

                        lon:
                            Number(
                                aircraft
                                    .llaLocation[1]
                            )

                    };

                }

            }

        } catch (error) {

            /*
             * Ignore GeoFS API differences.
             */

        }


        return null;

    }


    /*
     * =========================================================
     * STATE SHARING
     * =========================================================
     */

    function startStateSharing() {

        setInterval(
            function () {

                ownPosition =
                    getGeoFSPosition();


                sendRadioState();


                updateRemoteVolumes();

            },
            1000
        );

    }


    /*
     * =========================================================
     * RECEIVE DATA
     * =========================================================
     */

    function handleData(
        payload,
        participant
    ) {

        let data;


        try {

            data =
                JSON.parse(
                    new TextDecoder()
                        .decode(payload)
                );

        } catch (error) {

            return;

        }


        if (
            data.type !==
            "radio"
        ) {

            return;

        }


        players[
            participant.identity
        ] = {

            frequency:
                Number(
                    data.frequency
                ),

            transmitting:
                Boolean(
                    data.transmitting
                ),

            position:
                data.position

        };


        updatePlayerList();

        updateRemoteVolumes();

    }


    /*
     * =========================================================
     * DISTANCE
     * =========================================================
     */

    function distanceKm(
        a,
        b
    ) {

        if (
            !a ||
            !b
        ) {

            return 999999;

        }


        const R =
            6371;


        const lat1 =
            a.lat *
            Math.PI /
            180;


        const lat2 =
            b.lat *
            Math.PI /
            180;


        const dLat =
            (
                b.lat -
                a.lat
            ) *
            Math.PI /
            180;


        const dLon =
            (
                b.lon -
                a.lon
            ) *
            Math.PI /
            180;


        const x =
            Math.sin(
                dLat / 2
            ) *
            Math.sin(
                dLat / 2
            ) +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(
                dLon / 2
            ) *
            Math.sin(
                dLon / 2
            );


        const c =
            2 *
            Math.atan2(
                Math.sqrt(x),
                Math.sqrt(1 - x)
            );


        return R * c;

    }


    /*
     * =========================================================
     * AUDIO FILTER
     * =========================================================
     */

    function updateRemoteVolumes() {

        let receiving =
            false;


        for (
            const id in remoteAudio
        ) {

            const audio =
                remoteAudio[id].element;


            const player =
                players[id];


            if (!player) {

                audio.volume =
                    volume;

                continue;

            }


            /*
             * Frequency filtering.
             */

            if (
                player.frequency !==
                undefined
            ) {

                const sameFrequency =
                    Math.abs(
                        Number(
                            player.frequency
                        ) -
                        Number(
                            frequency
                        )
                    ) < 0.001;


                if (!sameFrequency) {

                    audio.volume =
                        0;

                    continue;

                }

            }


            /*
             * Distance attenuation.
             */

            let finalVolume =
                volume;


            if (
                ownPosition &&
                player.position
            ) {

                const distance =
                    distanceKm(
                        ownPosition,
                        player.position
                    );


                if (
                    distance >=
                    MAX_DISTANCE_KM
                ) {

                    finalVolume =
                        0;

                } else {

                    const attenuation =
                        1 -
                        (
                            distance /
                            MAX_DISTANCE_KM
                        );


                    finalVolume *=
                        attenuation;

                }

            }


            if (muted) {

                finalVolume =
                    0;

            }


            audio.volume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        finalVolume
                    )
                );


            if (
                player.transmitting &&
                finalVolume > 0
            ) {

                receiving =
                    true;

            }

        }


        updateRX(
            receiving
        );

    }


    /*
     * =========================================================
     * INDICATORS
     * =========================================================
     */

    function updateTX() {

        const tx =
            document.getElementById(
                "gvc-tx"
            );


        if (!tx) {

            return;

        }


        tx.style.background =
            transmitting
                ? "#a22"
                : "#222";

    }


    function updateRX(
        receiving
    ) {

        const rx =
            document.getElementById(
                "gvc-rx"
            );


        if (!rx) {

            return;

        }


        rx.style.background =
            receiving
                ? "#287"
                : "#222";

    }


    /*
     * =========================================================
     * PLAYER LIST
     * =========================================================
     */

    function updatePlayerList() {

        const container =
            document.getElementById(
                "gvc-players"
            );


        if (!container) {

            return;

        }


        const ids =
            Object.keys(players);


        if (
            ids.length === 0
        ) {

            container.textContent =
                "No other players";

            return;

        }


        container.innerHTML = "";


        for (
            const id of ids
        ) {

            const player =
                players[id];


            const row =
                document.createElement(
                    "div"
                );


            const sameFrequency =
                player.frequency &&
                Math.abs(
                    Number(
                        player.frequency
                    ) -
                    Number(
                        frequency
                    )
                ) < 0.001;


            row.textContent =
                id +
                "  " +
                (
                    sameFrequency
                        ? "RX"
                        : ""
                );


            row.style.padding =
                "2px";


            container.appendChild(
                row
            );

        }

    }


    /*
     * =========================================================
     * DISCONNECT
     * =========================================================
     */

    function disconnectVoice() {

        if (!room) {

            return;

        }


        try {

            room.disconnect();

        } catch (error) {}


        room =
            null;


        connected =
            false;


        transmitting =
            false;


        players =
            {};


        remoteAudio =
            {};


        setStatus(
            "OFFLINE"
        );


        const button =
            document.getElementById(
                "gvc-connect"
            );


        if (button) {

            button.textContent =
                "CONNECT";

        }


        updateTX();

        updateRX(false);

        updatePlayerList();

    }


    /*
     * =========================================================
     * LIVEKIT DATA EVENT
     * =========================================================
     */

    function installDataHandler() {

        /*
         * This is installed whenever a room
         * becomes available.
         */

        if (!room) {

            return;

        }


        room.on(
            livekit.RoomEvent.DataReceived,
            function (
                payload,
                participant
            ) {

                if (!participant) {

                    return;

                }


                handleData(
                    payload,
                    participant
                );

            }
        );

    }


    /*
     * Patch connect so our data handler
     * gets installed immediately after
     * connecting.
     */

    const originalConnect =
        connectVoice;


    /*
     * =========================================================
     * STARTUP
     * =========================================================
     */

    createUI();


    /*
     * We need the LiveKit data listener after
     * the room is created.
     *
     * A small observer checks for the room.
     */

    const roomWatcher =
        setInterval(
            function () {

                if (
                    room &&
                    livekit &&
                    !room._geofsDataInstalled
                ) {

                    room._geofsDataInstalled =
                        true;

                    installDataHandler();

                }

            },
            500
        );


    /*
     * Initial position updates.
     */

    setInterval(
        function () {

            ownPosition =
                getGeoFSPosition();

        },
        500
    );


    /*
     * Initial UI.
     */

    updateFrequencyDisplay();

})();
// ============================================================
// HIDE / SHOW VOICE PANEL WITH Y
// ============================================================

window.addEventListener("keydown", function (event) {

    // Don't trigger while typing in an input box
    if (
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA"
    ) {
        return;
    }

    if (event.code === "KeyY") {

        const panel =
            document.getElementById("geofs-voice-panel");

        if (!panel) {
            return;
        }

        if (panel.style.display === "none") {

            panel.style.display = "block";

        } else {

            panel.style.display = "none";

        }
    }

});
