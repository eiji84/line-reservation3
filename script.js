const LIFF_ID = "2010754159-BAb84dhl";
const MAKE_WEBHOOK = "https://hook.us2.make.com/ihrg6c2vcmqsfuqyyfkrd7b9ljyoaf43";
const AVAILABILITY_API = "https://script.google.com/macros/s/AKfycbx2V15h9Z32o4OVYmk5RS8AMtx8jsfZYSV54aVJtFa0UuW0twz--_lq0XAkHCgsg3uS/exec";

let selectedDate = "";
let selectedTime = "";

async function main() {
    try {
        await liff.init({
            liffId: LIFF_ID
        });

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        const profile = await liff.getProfile();

        document.getElementById("name").textContent =
            "こんにちは " + profile.displayName + " さん";

        createCalendar();

        document.getElementById("reserveButton").onclick =
            reserveButtonClicked;

    } catch (error) {
        console.error("LIFF initialization error:", error);

        document.getElementById("name").textContent =
            "初期化に失敗しました";

        alert("初期化に失敗しました: " + error.message);
    }
}

function createCalendar() {
    const calendarEl = document.getElementById("calendar");

    if (!calendarEl) {
        console.error("calendar element was not found");
        return;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "ja",
        height: "auto",

        headerToolbar: {
            left: "prev",
            center: "title",
            right: "next"
        },

        dateClick: async function (info) {
            selectedDate = info.dateStr;
            selectedTime = "";
        
            document
                .querySelectorAll(".fc-day-selected")
                .forEach(function (element) {
                    element.classList.remove("fc-day-selected");
                });
        
            info.dayEl.classList.add("fc-day-selected");
        
            await showTimes(info.dateStr);
        }
    });

    calendar.render();
}

async function showTimes(date) {
    const div = document.getElementById("times");

    div.innerHTML = "空き状況を確認しています…";

    const times = [
        "10:00",
        "10:30",
        "11:00",
        "13:00",
        "13:30",
        "14:00",
        "14:30",
        "15:00",
        "15:30",
        "16:00",
        "16:30"
    ];

    try {
        const url =
            AVAILABILITY_API
            + "?date="
            + encodeURIComponent(date);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("HTTP status: " + response.status);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || "空き状況を取得できませんでした");
        }

        const reservedTimes = result.reservedTimes || [];

        div.innerHTML = "";

        times.forEach(function (time) {
            const button = document.createElement("button");

            button.className = "timeButton";

            if (reservedTimes.includes(time)) {
                button.textContent = time + " 予約済み";
                button.disabled = true;
                button.classList.add("reserved");
            } else {
                button.textContent = time;

                button.onclick = function () {
                    selectedTime = time;

                    document
                        .querySelectorAll(".timeButton")
                        .forEach(function (element) {
                            element.classList.remove("selected");
                        });

                    button.classList.add("selected");
                };
            }

            div.appendChild(button);
        });

    } catch (error) {
        console.error("Availability error:", error);

        div.innerHTML = "";

        times.forEach(function (time) {
            const button = document.createElement("button");

            button.className = "timeButton";
            button.textContent = time;

            button.onclick = function () {
                selectedTime = time;

                document
                    .querySelectorAll(".timeButton")
                    .forEach(function (element) {
                        element.classList.remove("selected");
                    });

                button.classList.add("selected");
            };

            div.appendChild(button);
        });

        alert("空き状況を取得できませんでした");
    }
}

async function reserveButtonClicked() {
    if (selectedDate === "") {
        alert("日付を選択してください");
        return;
    }

    if (selectedTime === "") {
        alert("時間を選択してください");
        return;
    }

    try {
        const profile = await liff.getProfile();

        const data = {
            userId: profile.userId,
            name: profile.displayName,
            date: selectedDate,
            time: selectedTime
        };

        const response = await fetch(MAKE_WEBHOOK, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error("HTTP status: " + response.status);
        }

        alert("予約データを送信しました！");

    } catch (error) {
        console.error("Reservation error:", error);
        alert("送信に失敗しました: " + error.message);
    }
}

async function sendSelectedDateToMake(date) {
    try {
        const response = await fetch(AVAILABILITY_WEBHOOK, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                date: date
            })
        });

        console.log("Availability webhook status:", response.status);
        console.log("Availability webhook response:", await response.text());

    } catch (error) {
        console.error("Availability webhook error:", error);
    }
}

main();
