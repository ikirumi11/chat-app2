export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";

        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";

        const cleanUrl = supabaseUrl.replace(/\/+$/, "");

        const headers = {
            "apikey": supabaseKey,
            "Authorization": "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        const body = req.body || {};

        /*
        =====================================================
        HELPERS
        =====================================================
        */

        function cleanString(value, max = 200) {
            return String(value || "")
                .trim()
                .substring(0, max);
        }

        function randomId() {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
                return crypto.randomUUID();
            }

            return (
                Date.now().toString(36) +
                Math.random().toString(36).substring(2)
            );
        }

        async function readJson(response) {
            const text = await response.text();

            if (!text) {
                return {};
            }

            try {
                return JSON.parse(text);
            } catch {
                return {
                    message: text
                };
            }
        }

        function supabaseError(res, response, data) {
            return res.status(response.status).json({
                error:
                    data.message ||
                    data.error ||
                    "Supabase request failed.",
                details: data
            });
        }

        async function supabaseRequest(
            path,
            options = {}
        ) {
            const response = await fetch(
                cleanUrl + path,
                {
                    ...options,
                    headers: {
                        ...headers,
                        ...(options.headers || {})
                    }
                }
            );

            const data = await readJson(response);

            return {
                response,
                data
            };
        }

        function activityTablePath() {
            return "/rest/v1/activities";
        }

        function validGame(game) {
            return [
                "tic_tac_toe",
                "dice",
                "connect_four",
                "memory",
                "board"
            ].includes(game);
        }

        function maxPlayersForGame(game) {
            switch (game) {
                case "tic_tac_toe":
                    return 2;

                case "dice":
                    return 8;

                case "connect_four":
                    return 2;

                case "memory":
                    return 8;

                case "board":
                    return 4;

                default:
                    return 2;
            }
        }

        function createInitialState(game) {
            switch (game) {
                case "tic_tac_toe":
                    return {
                        board: Array(9).fill(""),
                        turnIndex: 0,
                        winner: null,
                        draw: false
                    };

                case "dice":
                    return {
                        turnIndex: 0,
                        rolls: {},
                        lastRoll: null,
                        winner: null,
                        finished: false
                    };

                case "connect_four":
                    return {
                        board: Array(42).fill(""),
                        turnIndex: 0,
                        winner: null,
                        draw: false
                    };

                case "memory": {
                    const cards = [];

                    for (let i = 0; i < 8; i++) {
                        cards.push(i);
                        cards.push(i);
                    }

                    for (let i = cards.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [cards[i], cards[j]] =
                            [cards[j], cards[i]];
                    }

                    return {
                        cards,
                        revealed: [],
                        matched: [],
                        scores: {},
                        turnIndex: 0,
                        winner: null,
                        finished: false
                    };
                }

                case "board":
                    return {
                        positions: {},
                        turnIndex: 0,
                        winner: null,
                        finished: false
                    };

                default:
                    return {};
            }
        }

        function getPlayers(activity) {
            if (!Array.isArray(activity.players)) {
                return [];
            }

            return activity.players;
        }

        function playerIndex(activity, deviceId) {
            return getPlayers(activity).findIndex(
                player => player.device_id === deviceId
            );
        }

        function isPlayer(activity, deviceId) {
            return playerIndex(activity, deviceId) !== -1;
        }

        function isHost(activity, deviceId) {
            return activity.host_device_id === deviceId;
        }

        function currentTurnPlayer(activity) {
            const players = getPlayers(activity);

            if (!players.length) {
                return null;
            }

            const index =
                Number(activity.state?.turnIndex || 0);

            return players[index % players.length] || null;
        }

        function gameFinished(activity) {
            return Boolean(
                activity.state &&
                (
                    activity.state.finished ||
                    activity.state.winner ||
                    activity.state.draw
                )
            );
        }

        function checkTicTacToe(board) {
            const wins = [
                [0, 1, 2],
                [3, 4, 5],
                [6, 7, 8],
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8],
                [0, 4, 8],
                [2, 4, 6]
            ];

            for (const line of wins) {
                const [a, b, c] = line;

                if (
                    board[a] &&
                    board[a] === board[b] &&
                    board[a] === board[c]
                ) {
                    return board[a];
                }
            }

            if (board.every(Boolean)) {
                return "DRAW";
            }

            return null;
        }

        function checkConnectFour(board) {
            const width = 7;
            const height = 6;

            function get(row, col) {
                return board[row * width + col];
            }

            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const player = get(row, col);

                    if (!player) {
                        continue;
                    }

                    const directions = [
                        [1, 0],
                        [0, 1],
                        [1, 1],
                        [1, -1]
                    ];

                    for (const [dr, dc] of directions) {
                        let count = 1;

                        for (let n = 1; n < 4; n++) {
                            const r = row + dr * n;
                            const c = col + dc * n;

                            if (
                                r < 0 ||
                                r >= height ||
                                c < 0 ||
                                c >= width
                            ) {
                                break;
                            }

                            if (get(r, c) !== player) {
                                break;
                            }

                            count++;
                        }

                        if (count >= 4) {
                            return player;
                        }
                    }
                }
            }

            if (board.every(Boolean)) {
                return "DRAW";
            }

            return null;
        }

        /*
        =====================================================
        CHAT GET
        =====================================================
        */

        if (
            req.method === "GET" &&
            !req.query.activity
        ) {
            const channel =
                cleanString(
                    req.query.channel || "general",
                    32
                );

            const url =
                activityTablePath() &&
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,device_id,edited,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const { response, data } =
                await supabaseRequest(url.replace(cleanUrl, ""), {
                    method: "GET"
                });

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            return res.status(200).json({
                success: true,
                messages:
                    Array.isArray(data)
                        ? data
                        : []
            });
        }

        /*
        =====================================================
        ACTIVITY GET
        =====================================================
        */

        if (
            req.method === "GET" &&
            req.query.activity
        ) {
            const id =
                cleanString(
                    req.query.activity,
                    100
                );

            const { response, data } =
                await supabaseRequest(
                    "/rest/v1/activities" +
                    "?select=*" +
                    "&id=eq." +
                    encodeURIComponent(id) +
                    "&limit=1",
                    {
                        method: "GET"
                    }
                );

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            if (!Array.isArray(data) || !data.length) {
                return res.status(404).json({
                    error: "Activity not found."
                });
            }

            return res.status(200).json({
                success: true,
                activity: data[0]
            });
        }

        /*
        =====================================================
        LIST ACTIVITIES
        =====================================================
        */

        if (
            req.method === "GET" &&
            req.query.activities === "true"
        ) {
            const { response, data } =
                await supabaseRequest(
                    "/rest/v1/activities" +
                    "?select=*" +
                    "&status=in.(waiting,running)" +
                    "&order=created_at.desc",
                    {
                        method: "GET"
                    }
                );

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            return res.status(200).json({
                success: true,
                activities:
                    Array.isArray(data)
                        ? data
                        : []
            });
        }

        /*
        =====================================================
        CHAT POST / ACTIVITY CREATE
        =====================================================
        */

        if (req.method === "POST") {

            /*
            -----------------------------------------------
            CREATE ACTIVITY
            -----------------------------------------------
            */

            if (body.action === "create_activity") {

                const username =
                    cleanString(
                        body.username,
                        24
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const game =
                    cleanString(
                        body.game,
                        40
                    );

                if (!username || !deviceId) {
                    return res.status(400).json({
                        error:
                            "Username and device ID are required."
                    });
                }

                if (!validGame(game)) {
                    return res.status(400).json({
                        error:
                            "Invalid game."
                    });
                }

                const id = randomId();

                const player = {
                    device_id: deviceId,
                    username,
                    joined_at: new Date().toISOString()
                };

                const activity = {
                    id,
                    game,
                    host_device_id: deviceId,
                    host_username: username,
                    status: "waiting",
                    players: [player],
                    state: createInitialState(game),
                    max_players:
                        maxPlayersForGame(game)
                };

                const { response, data } =
                    await supabaseRequest(
                        "/rest/v1/activities",
                        {
                            method: "POST",
                            headers: {
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify(activity)
                        }
                    );

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                return res.status(200).json({
                    success: true,
                    activity:
                        Array.isArray(data)
                            ? data[0]
                            : data
                });
            }

            /*
            -----------------------------------------------
            JOIN ACTIVITY
            -----------------------------------------------
            */

            if (body.action === "join_activity") {

                const id =
                    cleanString(
                        body.activity_id,
                        100
                    );

                const username =
                    cleanString(
                        body.username,
                        24
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                if (!id || !username || !deviceId) {
                    return res.status(400).json({
                        error:
                            "Activity ID, username and device ID are required."
                    });
                }

                const get =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?select=*" +
                        "&id=eq." +
                        encodeURIComponent(id) +
                        "&limit=1",
                        {
                            method: "GET"
                        }
                    );

                if (!get.response.ok) {
                    return supabaseError(
                        res,
                        get.response,
                        get.data
                    );
                }

                if (!get.data.length) {
                    return res.status(404).json({
                        error:
                            "Activity not found."
                    });
                }

                const activity = get.data[0];

                if (activity.status !== "waiting") {
                    return res.status(409).json({
                        error:
                            "The game has already started. You are a spectator."
                    });
                }

                let players =
                    getPlayers(activity);

                if (
                    players.some(
                        p =>
                            p.device_id === deviceId
                    )
                ) {
                    return res.status(200).json({
                        success: true,
                        activity
                    });
                }

                if (
                    players.length >=
                    activity.max_players
                ) {
                    return res.status(409).json({
                        error:
                            "This game is full."
                    });
                }

                players.push({
                    device_id: deviceId,
                    username,
                    joined_at:
                        new Date().toISOString()
                });

                const update =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?id=eq." +
                        encodeURIComponent(id),
                        {
                            method: "PATCH",
                            headers: {
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify({
                                    players
                                })
                        }
                    );

                if (!update.response.ok) {
                    return supabaseError(
                        res,
                        update.response,
                        update.data
                    );
                }

                return res.status(200).json({
                    success: true,
                    activity:
                        update.data[0]
                });
            }

            /*
            -----------------------------------------------
            LEAVE ACTIVITY
            -----------------------------------------------
            */

            if (body.action === "leave_activity") {

                const id =
                    cleanString(
                        body.activity_id,
                        100
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const get =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?select=*" +
                        "&id=eq." +
                        encodeURIComponent(id) +
                        "&limit=1",
                        {
                            method: "GET"
                        }
                    );

                if (!get.data.length) {
                    return res.status(404).json({
                        error:
                            "Activity not found."
                    });
                }

                const activity = get.data[0];

                if (activity.status !== "waiting") {
                    return res.status(409).json({
                        error:
                            "You cannot leave a started game."
                    });
                }

                const players =
                    getPlayers(activity)
                        .filter(
                            p =>
                                p.device_id !==
                                deviceId
                        );

                if (
                    activity.host_device_id ===
                    deviceId
                ) {
                    if (!players.length) {
                        await supabaseRequest(
                            "/rest/v1/activities" +
                            "?id=eq." +
                            encodeURIComponent(id),
                            {
                                method: "DELETE"
                            }
                        );

                        return res.status(200).json({
                            success: true,
                            deleted: true
                        });
                    }

                    const newHost =
                        players[0];

                    const update =
                        await supabaseRequest(
                            "/rest/v1/activities" +
                            "?id=eq." +
                            encodeURIComponent(id),
                            {
                                method: "PATCH",
                                headers: {
                                    "Prefer":
                                        "return=representation"
                                },
                                body:
                                    JSON.stringify({
                                        players,
                                        host_device_id:
                                            newHost.device_id,
                                        host_username:
                                            newHost.username
                                    })
                            }
                        );

                    return res.status(200).json({
                        success: true,
                        activity:
                            update.data[0]
                    });
                }

                const update =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?id=eq." +
                        encodeURIComponent(id),
                        {
                            method: "PATCH",
                            headers: {
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify({
                                    players
                                })
                        }
                    );

                return res.status(200).json({
                    success: true,
                    activity:
                        update.data[0]
                });
            }

            /*
            -----------------------------------------------
            START ACTIVITY
            -----------------------------------------------
            */

            if (body.action === "start_activity") {

                const id =
                    cleanString(
                        body.activity_id,
                        100
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const get =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?select=*" +
                        "&id=eq." +
                        encodeURIComponent(id) +
                        "&limit=1",
                        {
                            method: "GET"
                        }
                    );

                if (!get.data.length) {
                    return res.status(404).json({
                        error:
                            "Activity not found."
                    });
                }

                const activity = get.data[0];

                if (
                    !isHost(
                        activity,
                        deviceId
                    )
                ) {
                    return res.status(403).json({
                        error:
                            "Only the host can start the game."
                    });
                }

                if (activity.status !== "waiting") {
                    return res.status(409).json({
                        error:
                            "This activity has already started."
                    });
                }

                if (
                    getPlayers(activity).length < 1
                ) {
                    return res.status(400).json({
                        error:
                            "At least one player is required."
                    });
                }

                /*
                 * IMPORTANT:
                 *
                 * The players array is NOT changed here.
                 * This locks the exact people who joined
                 * before Start was pressed.
                 */

                const update =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?id=eq." +
                        encodeURIComponent(id),
                        {
                            method: "PATCH",
                            headers: {
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify({
                                    status: "running"
                                })
                        }
                    );

                if (!update.response.ok) {
                    return supabaseError(
                        res,
                        update.response,
                        update.data
                    );
                }

                return res.status(200).json({
                    success: true,
                    activity:
                        update.data[0]
                });
            }

            /*
            -----------------------------------------------
            GAME MOVE
            -----------------------------------------------
            */

            if (body.action === "game_move") {

                const id =
                    cleanString(
                        body.activity_id,
                        100
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const move = body.move;

                const get =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?select=*" +
                        "&id=eq." +
                        encodeURIComponent(id) +
                        "&limit=1",
                        {
                            method: "GET"
                        }
                    );

                if (!get.data.length) {
                    return res.status(404).json({
                        error:
                            "Activity not found."
                    });
                }

                const activity = get.data[0];

                if (activity.status !== "running") {
                    return res.status(409).json({
                        error:
                            "The game is not running."
                    });
                }

                if (
                    !isPlayer(
                        activity,
                        deviceId
                    )
                ) {
                    return res.status(403).json({
                        error:
                            "Spectators cannot make moves."
                    });
                }

                if (gameFinished(activity)) {
                    return res.status(409).json({
                        error:
                            "The game is already finished."
                    });
                }

                const players =
                    getPlayers(activity);

                const myIndex =
                    playerIndex(
                        activity,
                        deviceId
                    );

                const turnIndex =
                    Number(
                        activity.state?.turnIndex || 0
                    ) % players.length;

                if (myIndex !== turnIndex) {
                    return res.status(409).json({
                        error:
                            "It is not your turn."
                    });
                }

                const state =
                    JSON.parse(
                        JSON.stringify(
                            activity.state || {}
                        )
                    );

                /*
                =============================================
                TIC TAC TOE
                =============================================
                */

                if (
                    activity.game ===
                    "tic_tac_toe"
                ) {
                    const position =
                        Number(move?.position);

                    if (
                        !Number.isInteger(position) ||
                        position < 0 ||
                        position > 8
                    ) {
                        return res.status(400).json({
                            error:
                                "Invalid board position."
                        });
                    }

                    if (state.board[position]) {
                        return res.status(409).json({
                            error:
                                "That space is already occupied."
                        });
                    }

                    const symbol =
                        myIndex === 0
                            ? "X"
                            : "O";

                    state.board[position] =
                        symbol;

                    const result =
                        checkTicTacToe(
                            state.board
                        );

                    if (result === "DRAW") {
                        state.draw = true;
                        state.finished = true;
                    } else if (result) {
                        state.winner =
                            players[
                                result === "X"
                                    ? 0
                                    : 1
                            ].device_id;

                        state.winner_username =
                            players[
                                result === "X"
                                    ? 0
                                    : 1
                            ].username;

                        state.finished = true;
                    } else {
                        state.turnIndex =
                            (turnIndex + 1) %
                            players.length;
                    }
                }

                /*
                =============================================
                DICE
                =============================================
                */

                else if (
                    activity.game ===
                    "dice"
                ) {
                    const roll =
                        Math.floor(
                            Math.random() * 6
                        ) + 1;

                    state.lastRoll = {
                        device_id: deviceId,
                        username:
                            players[myIndex]
                                .username,
                        value: roll,
                        at:
                            new Date()
                                .toISOString()
                    };

                    if (!state.rolls) {
                        state.rolls = {};
                    }

                    if (
                        !state.rolls[deviceId]
                    ) {
                        state.rolls[deviceId] = 0;
                    }

                    state.rolls[deviceId] +=
                        roll;

                    /*
                     * First player to reach 30 wins.
                     */
                    if (
                        state.rolls[deviceId] >=
                        30
                    ) {
                        state.winner =
                            deviceId;

                        state.winner_username =
                            players[myIndex]
                                .username;

                        state.finished = true;
                    } else {
                        state.turnIndex =
                            (turnIndex + 1) %
                            players.length;
                    }
                }

                /*
                =============================================
                CONNECT FOUR
                =============================================
                */

                else if (
                    activity.game ===
                    "connect_four"
                ) {
                    const column =
                        Number(move?.column);

                    if (
                        !Number.isInteger(column) ||
                        column < 0 ||
                        column > 6
                    ) {
                        return res.status(400).json({
                            error:
                                "Invalid column."
                        });
                    }

                    const symbol =
                        myIndex === 0
                            ? "X"
                            : "O";

                    let placed = -1;

                    for (
                        let row = 5;
                        row >= 0;
                        row--
                    ) {
                        const index =
                            row * 7 +
                            column;

                        if (!state.board[index]) {
                            state.board[index] =
                                symbol;

                            placed = index;
                            break;
                        }
                    }

                    if (placed === -1) {
                        return res.status(409).json({
                            error:
                                "That column is full."
                        });
                    }

                    const result =
                        checkConnectFour(
                            state.board
                        );

                    if (result === "DRAW") {
                        state.draw = true;
                        state.finished = true;
                    } else if (result) {
                        state.winner =
                            players[
                                result === "X"
                                    ? 0
                                    : 1
                            ].device_id;

                        state.winner_username =
                            players[
                                result === "X"
                                    ? 0
                                    : 1
                            ].username;

                        state.finished = true;
                    } else {
                        state.turnIndex =
                            (turnIndex + 1) %
                            players.length;
                    }
                }

                /*
                =============================================
                MEMORY
                =============================================
                */

                else if (
                    activity.game ===
                    "memory"
                ) {
                    const position =
                        Number(move?.position);

                    if (
                        !Number.isInteger(position) ||
                        position < 0 ||
                        position >=
                            state.cards.length
                    ) {
                        return res.status(400).json({
                            error:
                                "Invalid card."
                        });
                    }

                    if (
                        state.matched.includes(
                            position
                        ) ||
                        state.revealed.includes(
                            position
                        )
                    ) {
                        return res.status(409).json({
                            error:
                                "That card is unavailable."
                        });
                    }

                    state.revealed.push(position);

                    if (state.revealed.length === 2) {
                        const [a, b] =
                            state.revealed;

                        if (
                            state.cards[a] ===
                            state.cards[b]
                        ) {
                            state.matched.push(a);
                            state.matched.push(b);

                            if (
                                !state.scores[deviceId]
                            ) {
                                state.scores[deviceId] =
                                    0;
                            }

                            state.scores[deviceId]++;

                            state.revealed = [];

                            if (
                                state.matched.length ===
                                state.cards.length
                            ) {
                                let winner = null;
                                let highest = -1;

                                for (
                                    const player of players
                                ) {
                                    const score =
                                        state.scores[
                                            player.device_id
                                        ] || 0;

                                    if (
                                        score >
                                        highest
                                    ) {
                                        highest = score;
                                        winner =
                                            player;
                                    }
                                }

                                state.winner =
                                    winner.device_id;

                                state.winner_username =
                                    winner.username;

                                state.finished =
                                    true;
                            }
                        } else {
                            /*
                             * Leave the two cards
                             * visible briefly on the
                             * client. The client can
                             * request a flip-back.
                             */
                            state.pendingMismatch = true;
                        }
                    } else {
                        state.turnIndex =
                            turnIndex;
                    }
                }

                /*
                =============================================
                SIMPLE BOARD GAME
                =============================================
                */

                else if (
                    activity.game ===
                    "board"
                ) {
                    const steps =
                        Number(move?.steps);

                    if (
                        !Number.isInteger(steps) ||
                        steps < 1 ||
                        steps > 6
                    ) {
                        return res.status(400).json({
                            error:
                                "Invalid board roll."
                        });
                    }

                    if (!state.positions) {
                        state.positions = {};
                    }

                    const current =
                        Number(
                            state.positions[
                                deviceId
                            ] || 0
                        );

                    const next =
                        Math.min(
                            30,
                            current + steps
                        );

                    state.positions[
                        deviceId
                    ] = next;

                    if (next >= 30) {
                        state.winner =
                            deviceId;

                        state.winner_username =
                            players[myIndex]
                                .username;

                        state.finished = true;
                    } else {
                        state.turnIndex =
                            (turnIndex + 1) %
                            players.length;
                    }
                }

                else {
                    return res.status(400).json({
                        error:
                            "Unsupported game."
                    });
                }

                const update =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?id=eq." +
                        encodeURIComponent(id),
                        {
                            method: "PATCH",
                            headers: {
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify({
                                    state
                                })
                        }
                    );

                if (!update.response.ok) {
                    return supabaseError(
                        res,
                        update.response,
                        update.data
                    );
                }

                return res.status(200).json({
                    success: true,
                    activity:
                        update.data[0]
                });
            }

            /*
            -----------------------------------------------
            NORMAL CHAT MESSAGE
            -----------------------------------------------
            */

            const username =
                cleanString(
                    body.username,
                    24
                );

            const channel =
                cleanString(
                    body.channel || "general",
                    32
                );

            const message =
                cleanString(
                    body.message,
                    2000
                );

            const deviceId =
                cleanString(
                    body.device_id,
                    100
                );

            let image = null;

            if (
                body.image &&
                typeof body.image === "string"
            ) {
                image = body.image;
            }

            if (!username) {
                return res.status(400).json({
                    error:
                        "Username is required."
                });
            }

            if (!message && !image) {
                return res.status(400).json({
                    error:
                        "Message or image is required."
                });
            }

            if (
                image &&
                image.length > 5000000
            ) {
                return res.status(413).json({
                    error:
                        "Image is too large."
                });
            }

            if (
                image &&
                !image.startsWith("data:image/")
            ) {
                return res.status(400).json({
                    error:
                        "Invalid image data."
                });
            }

            const messageData = {
                username,
                channel,
                message,
                image,
                device_id: deviceId,
                edited: false
            };

            const { response, data } =
                await supabaseRequest(
                    "/rest/v1/messages",
                    {
                        method: "POST",
                        headers: {
                            "Prefer":
                                "return=representation"
                        },
                        body:
                            JSON.stringify(
                                messageData
                            )
                    }
                );

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            return res.status(200).json({
                success: true,
                message:
                    Array.isArray(data)
                        ? data[0]
                        : data
            });
        }

        /*
        =====================================================
        PATCH
        =====================================================
        */

        if (req.method === "PATCH") {

            const id =
                cleanString(
                    body.id,
                    100
                );

            const deviceId =
                cleanString(
                    body.device_id,
                    100
                );

            const message =
                cleanString(
                    body.message,
                    2000
                );

            if (!id || !deviceId) {
                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });
            }

            const { response, data } =
                await supabaseRequest(
                    "/rest/v1/messages" +
                    "?id=eq." +
                    encodeURIComponent(id) +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId),
                    {
                        method: "PATCH",
                        headers: {
                            "Prefer":
                                "return=representation"
                        },
                        body:
                            JSON.stringify({
                                message,
                                edited: true
                            })
                    }
                );

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            if (
                !Array.isArray(data) ||
                !data.length
            ) {
                return res.status(403).json({
                    error:
                        "You cannot edit this message."
                });
            }

            return res.status(200).json({
                success: true,
                message: data[0]
            });
        }

        /*
        =====================================================
        DELETE
        =====================================================
        */

        if (req.method === "DELETE") {

            /*
            -----------------------------------------------
            WIPE CHAT
            -----------------------------------------------
            */

            if (body.delete_all === true) {

                const { response, data } =
                    await supabaseRequest(
                        "/rest/v1/messages?id=not.is.null",
                        {
                            method: "DELETE",
                            headers: {
                                "Prefer":
                                    "return=minimal"
                            }
                        }
                    );

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                return res.status(200).json({
                    success: true,
                    message:
                        "All messages were deleted."
                });
            }

            /*
            -----------------------------------------------
            DELETE ACTIVITY
            -----------------------------------------------
            */

            if (
                body.action ===
                "delete_activity"
            ) {
                const id =
                    cleanString(
                        body.activity_id,
                        100
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const get =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?select=*" +
                        "&id=eq." +
                        encodeURIComponent(id) +
                        "&limit=1",
                        {
                            method: "GET"
                        }
                    );

                if (!get.data.length) {
                    return res.status(404).json({
                        error:
                            "Activity not found."
                    });
                }

                if (
                    get.data[0]
                        .host_device_id !==
                    deviceId
                ) {
                    return res.status(403).json({
                        error:
                            "Only the host can end the activity."
                    });
                }

                const { response, data } =
                    await supabaseRequest(
                        "/rest/v1/activities" +
                        "?id=eq." +
                        encodeURIComponent(id),
                        {
                            method: "DELETE"
                        }
                    );

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                return res.status(200).json({
                    success: true
                });
            }

            /*
            -----------------------------------------------
            DELETE ONE MESSAGE
            -----------------------------------------------
            */

            const id =
                cleanString(
                    body.id,
                    100
                );

            const deviceId =
                cleanString(
                    body.device_id,
                    100
                );

            if (!id || !deviceId) {
                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });
            }

            const { response, data } =
                await supabaseRequest(
                    "/rest/v1/messages" +
                    "?id=eq." +
                    encodeURIComponent(id) +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId),
                    {
                        method: "DELETE",
                        headers: {
                            "Prefer":
                                "return=representation"
                        }
                    }
                );

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            if (
                !Array.isArray(data) ||
                !data.length
            ) {
                return res.status(403).json({
                    error:
                        "You cannot delete this message."
                });
            }

            return res.status(200).json({
                success: true,
                message:
                    "Message deleted."
            });
        }

        return res.status(405).json({
            error:
                "Method not allowed."
        });

    } catch (error) {

        console.error(
            "CHAT/ACTIVITY API ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Server error."
        });
    }
}