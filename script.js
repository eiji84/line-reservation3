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

        initializeScheduleNavigation();
        await createScheduleTable();
        
        document.getElementById("reserveButton").onclick =
            reserveButtonClicked;

    } catch (error) {
        console.error("LIFF initialization error:", error);

        document.getElementById("name").textContent =
            "初期化に失敗しました";

        alert("初期化に失敗しました: " + error.message);
    }
}

const DISPLAY_DAYS = 7;

const AVAILABLE_TIMES = [
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

let currentStartDate = startOfToday();

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function addDays(date, numberOfDays) {
    const result = new Date(date);
    result.setDate(result.getDate() + numberOfDays);
    return result;
}

function formatDateForApi(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDayLabel(date) {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    return {
        day: date.getDate(),
        weekday: weekdays[date.getDay()]
    };
}

function isSameDate(date1, date2) {
    return (
        date1.getFullYear() === date2.getFullYear()
        && date1.getMonth() === date2.getMonth()
        && date1.getDate() === date2.getDate()
    );
}

function isPastDate(date) {
    const today = startOfToday();

    return date < today;
}

function isPastDateTime(date, time) {
    const [hours, minutes] = time.split(":").map(Number);

    const target = new Date(date);
    target.setHours(hours, minutes, 0, 0);

    return target <= new Date();
}

async function createScheduleTable() {
    const head = document.getElementById("scheduleHead");
    const body = document.getElementById("scheduleBody");
    const title = document.getElementById("scheduleTitle");

    head.innerHTML = "";
    body.innerHTML = "";

    const endDate = addDays(currentStartDate, DISPLAY_DAYS - 1);

    title.textContent =
        `${currentStartDate.getMonth() + 1}月`
        + ` ${currentStartDate.getDate()}日`
        + `〜${endDate.getMonth() + 1}月${endDate.getDate()}日`;

    const dates = [];

    for (let i = 0; i < DISPLAY_DAYS; i++) {
        dates.push(addDays(currentStartDate, i));
    }

    const headerRow = document.createElement("tr");

    const timeHeader = document.createElement("th");
    timeHeader.className = "time-header";
    timeHeader.textContent = "";
    headerRow.appendChild(timeHeader);

    dates.forEach(function (date) {
        const label = formatDayLabel(date);
        const th = document.createElement("th");

        th.innerHTML = `
            <div class="day-number">${label.day}</div>
            <div class="weekday">${label.weekday}</div>
        `;

        if (date.getDay() === 0) {
            th.classList.add("sunday");
        }

        if (date.getDay() === 6) {
            th.classList.add("saturday");
        }

        if (isSameDate(date, new Date())) {
            th.classList.add("today");
        }

        headerRow.appendChild(th);
    });

    head.appendChild(headerRow);

    body.innerHTML = `
        <tr>
            <td colspan="${DISPLAY_DAYS + 1}" class="loading-cell">
                空き状況を確認しています…
            </td>
        </tr>
    `;

    const availabilityMap = await loadAvailabilityForDates(dates);

    body.innerHTML = "";

    AVAILABLE_TIMES.forEach(function (time) {
        const row = document.createElement("tr");

        const timeCell = document.createElement("th");
        timeCell.className = "time-cell";
        timeCell.textContent = time;
        row.appendChild(timeCell);

        dates.forEach(function (date) {
            const dateString = formatDateForApi(date);
            const reservedTimes = availabilityMap[dateString] || [];

            const cell = document.createElement("td");
            const button = document.createElement("button");

            button.type = "button";
            button.className = "availability-button";

            const unavailable =
                isPastDate(date)
                || isPastDateTime(date, time)
                || reservedTimes.includes(time);

            if (unavailable) {
                button.textContent = "×";
                button.disabled = true;
                button.classList.add("unavailable");
            } else {
                button.textContent = "○";
                button.classList.add("available");

                button.onclick = function () {
                    selectReservation(
                        dateString,
                        time,
                        button
                    );
                };
            }

            cell.appendChild(button);
            row.appendChild(cell);
        });

        body.appendChild(row);
    });

    updatePreviousButton();
}

async function loadAvailabilityForDates(dates) {
    const resultMap = {};

    await Promise.all(
        dates.map(async function (date) {
            const dateString = formatDateForApi(date);

            try {
                const response = await fetch(
                    AVAILABILITY_API
                    + "?date="
                    + encodeURIComponent(dateString)
                );

                if (!response.ok) {
                    throw new Error(
                        "HTTP status: " + response.status
                    );
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(
                        result.message
                        || "空き状況を取得できませんでした"
                    );
                }

                resultMap[dateString] =
                    result.reservedTimes || [];

            } catch (error) {
                console.error(
                    "Availability error:",
                    dateString,
                    error
                );

                /*
                 * 取得に失敗した日は、安全のため全枠を予約不可にする
                 */
                resultMap[dateString] = [...AVAILABLE_TIMES];
            }
        })
    );

    return resultMap;
}

function selectReservation(date, time, button) {
    selectedDate = date;
    selectedTime = time;

    document
        .querySelectorAll(".availability-button.selected")
        .forEach(function (element) {
            element.classList.remove("selected");
        });

    button.classList.add("selected");

    const selectedText =
        document.getElementById("selectedReservation");

    selectedText.textContent =
        `${formatJapaneseDate(date)} ${time}を選択中`;
}

function formatJapaneseDate(dateString) {
    const [year, month, day] =
        dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    const weekdays =
        ["日", "月", "火", "水", "木", "金", "土"];

    return (
        `${month}月${day}日`
        + `（${weekdays[date.getDay()]}）`
    );
}

function updatePreviousButton() {
    const previousButton =
        document.getElementById("prevWeekButton");

    previousButton.disabled =
        currentStartDate <= startOfToday();
}

function initializeScheduleNavigation() {
    document
        .getElementById("prevWeekButton")
        .addEventListener("click", async function () {
            const previousStart =
                addDays(currentStartDate, -DISPLAY_DAYS);

            /*
             * 過去へ移動しすぎない
             */
            currentStartDate =
                previousStart < startOfToday()
                    ? startOfToday()
                    : previousStart;

            clearSelection();
            await createScheduleTable();
        });

    document
        .getElementById("nextWeekButton")
        .addEventListener("click", async function () {
            currentStartDate =
                addDays(currentStartDate, DISPLAY_DAYS);

            clearSelection();
            await createScheduleTable();
        });
}

function clearSelection() {
    selectedDate = "";
    selectedTime = "";

    document.getElementById(
        "selectedReservation"
    ).textContent = "";
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

    const reserveButton = document.getElementById("reserveButton");
    const originalButtonText = reserveButton.textContent;

    reserveButton.disabled = true;
    reserveButton.textContent = "予約処理中…";

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

        /*
         * Makeが500などを返した場合
         */
        if (!response.ok) {
            let errorMessage = "予約処理に失敗しました";

            try {
                const errorResult = await response.json();

                if (errorResult.message) {
                    errorMessage = errorResult.message;
                }
            } catch (_) {
                // JSONでない場合は既定メッセージを使用
            }

            throw new Error(errorMessage);
        }

        /*
         * MakeからのJSONレスポンスを取得
         */
        const result = await response.json();

        /*
         * HTTP 200でも success:false の場合は失敗扱い
         */
        if (result.success !== true) {
            throw new Error(
                result.message || "予約処理を完了できませんでした"
            );
        }

        /*
         * Makeの全処理成功後にだけ完了表示
         */
        reserveButton.textContent = "予約完了！";

        /*
         * LINEアプリ内なら少し待ってLIFFを閉じる
         */
        if (liff.isInClient()) {
            setTimeout(function () {
                liff.closeWindow();
            }, 800);
        } else {
            /*
             * PCブラウザではcloseWindowが保証されないため、
             * 予約画面を非表示にして完了画面にする
             */
            document.querySelector(".schedule-header").style.display = "none";
                document.querySelector(".schedule-scroll").style.display = "none";
                document.getElementById("selectedReservation").style.display = "none";
                reserveButton.style.display = "none";
            
                document.getElementById("name").textContent =
                    result.message || "予約が完了しました。";
        }
    } catch (error) {
        console.error("Reservation error:", error);

        alert(
            error.message ||
            "予約処理に失敗しました。時間をおいて再度お試しください。"
        );

        /*
         * エラー時は画面を閉じず、再試行できるように戻す
         */
        reserveButton.disabled = false;
        reserveButton.textContent = originalButtonText;
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
