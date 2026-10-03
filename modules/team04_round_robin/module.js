// ==========================================
// ROUND ROBIN CPU SCHEDULING
// ==========================================


// Short selector
const $ = id => document.getElementById(id);


// ==========================================
// CREATE PROCESS ROWS
// ==========================================

function createProcesses() {

    let count =
        Number($("processCount").value);


    // Limit between 1 and 20
    count =
        Math.max(
            1,
            Math.min(20, count)
        );


    $("processCount").value =
        count;


    const body =
        $("processTableBody");


    body.innerHTML = "";


    for (
        let i = 1;
        i <= count;
        i++
    ) {

        body.innerHTML += `

            <tr>

                <td>

                    <input
                        class="pid"
                        value="P${i}"
                    >

                </td>


                <td>

                    <input
                        class="arrival"
                        type="number"
                        value="${i - 1}"
                        min="0"
                    >

                </td>


                <td>

                    <input
                        class="burst"
                        type="number"
                        value="1"
                        min="1"
                    >

                </td>

            </tr>

        `;

    }


    clearResults();

    showInitialQueue();

}


// ==========================================
// GET USER PROCESSES
// ==========================================

function getProcesses() {

    const rows =
        document.querySelectorAll(
            "#processTableBody tr"
        );


    const processes = [];


    rows.forEach(
        (row, index) => {

            const id =
                row.querySelector(
                    ".pid"
                ).value.trim();


            const arrival =
                Number(
                    row.querySelector(
                        ".arrival"
                    ).value
                );


            const burst =
                Number(
                    row.querySelector(
                        ".burst"
                    ).value
                );


            // Validate

            if (

                !id ||

                !Number.isFinite(
                    arrival
                ) ||

                arrival < 0 ||

                !Number.isFinite(
                    burst
                ) ||

                burst <= 0

            ) {

                throw new Error(

                    "Invalid values in process " +
                    (index + 1) +

                    ". Please enter a valid " +
                    "Process ID, Arrival Time and Burst Time."

                );

            }


            processes.push({

                id:
                    id,

                arrival:
                    arrival,

                burst:
                    burst,

                remaining:
                    burst,

                order:
                    index

            });

        }
    );


    if (
        processes.length === 0
    ) {

        throw new Error(
            "Please enter at least one process."
        );

    }


    // Check duplicate IDs

    const ids =
        processes.map(
            p => p.id
        );


    if (
        new Set(ids).size !==
        ids.length
    ) {

        throw new Error(
            "Process IDs must be unique."
        );

    }


    return processes;

}


// ==========================================
// ROUND ROBIN ALGORITHM
// ==========================================

function runRoundRobin() {


    let processes;


    // Get user input

    try {

        processes =
            getProcesses();

    }

    catch (error) {

        alert(
            error.message
        );

        return;

    }



    // Get quantum

    const quantum =
        Number(
            $("quantum").value
        );


    if (

        !Number.isFinite(
            quantum
        ) ||

        quantum <= 0

    ) {

        alert(
            "Enter a valid Time Quantum."
        );

        return;

    }



    // ==========================================
    // SORT BY ARRIVAL TIME
    // ==========================================

    processes.sort(

        (a, b) =>

            a.arrival -
            b.arrival

            ||

            a.order -
            b.order

    );



    let time = 0;

    let completed = 0;

    let index = 0;



    const queue = [];

    const gantt = [];

    const completion = {};



    // ==========================================
    // SIMULATION
    // ==========================================

    while (

        completed <
        processes.length

    ) {


        // Add arrived processes

        while (

            index <
            processes.length &&

            processes[index].arrival <=
            time

        ) {

            queue.push(
                processes[index]
            );

            index++;

        }



        // ==========================================
        // CPU IDLE
        // ==========================================

        if (
            queue.length === 0
        ) {


            if (
                index <
                processes.length
            ) {


                const next =
                    processes[index];


                gantt.push({

                    id:
                        "Idle",

                    start:
                        time,

                    end:
                        next.arrival

                });


                time =
                    next.arrival;


                continue;

            }

        }



        // ==========================================
        // GET FIRST PROCESS
        // ==========================================

        const process =
            queue.shift();


        const start =
            time;


        const runTime =
            Math.min(

                quantum,

                process.remaining

            );


        // Run process

        time +=
            runTime;


        process.remaining -=
            runTime;



        // Add to Gantt

        gantt.push({

            id:
                process.id,

            start:
                start,

            end:
                time

        });



        // Add processes which arrived
        // during execution

        while (

            index <
            processes.length &&

            processes[index].arrival <=
            time

        ) {

            queue.push(
                processes[index]
            );

            index++;

        }



        // ==========================================
        // PROCESS COMPLETED
        // ==========================================

        if (
            process.remaining === 0
        ) {

            completion[
                process.id
            ] =
                time;


            completed++;

        }


        // ==========================================
        // PROCESS NOT COMPLETED
        // ==========================================

        else {

            queue.push(
                process
            );

        }

    }



    // ==========================================
    // CALCULATE RESULTS
    // ==========================================

    let totalWaiting = 0;

    let totalTurnaround = 0;


    const results = [];


    // Return to original input order

    processes
        .slice()
        .sort(
            (a, b) =>
                a.order -
                b.order
        )
        .forEach(
            process => {


                const ct =
                    completion[
                        process.id
                    ];


                const tat =
                    ct -
                    process.arrival;


                const wt =
                    tat -
                    process.burst;



                totalWaiting +=
                    wt;


                totalTurnaround +=
                    tat;



                results.push({

                    id:
                        process.id,

                    completion:
                        ct,

                    turnaround:
                        tat,

                    waiting:
                        wt

                });

            }
        );



    // ==========================================
    // DISPLAY RESULTS
    // ==========================================

    showResults(

        results,

        totalWaiting /
        results.length,

        totalTurnaround /
        results.length

    );
    showGantt(
        gantt
    );
    showQueue(
        gantt
    );
}
// SHOW SCHEDULING RESULTS
function showResults(

    results,

    avgWaiting,

    avgTurnaround

) {
    const body =
        $("resultsBody");


    body.innerHTML = "";



    results.forEach(
        result => {


            body.innerHTML += `

                <tr>

                    <td>
                        ${result.id}
                    </td>

                    <td>
                        ${result.completion}
                    </td>

                    <td>
                        ${result.turnaround}
                    </td>

                    <td>
                        ${result.waiting}
                    </td>

                </tr>

            `;

        }
    );
    $("avgWaiting").textContent =
        format(avgWaiting);
    $("avgTurnaround").textContent =
        format(avgTurnaround);

}
// SHOW GANTT CHART
function showGantt(gantt) {
    const chart =
        $("ganttChart");
    // Clear chart
    chart.innerHTML = "";
    chart.style.display =
        "block";


    chart.style.width =
        "100%";


    chart.style.maxWidth =
        "100%";


    chart.style.overflowX =
        "auto";


    chart.style.overflowY =
        "hidden";


    chart.style.boxSizing =
        "border-box";


    chart.style.padding =
        "40px 10px";


    chart.style.whiteSpace =
        "nowrap";



    // ==========================================
    // CREATE INNER TRACK
    // ==========================================

    const track =
        document.createElement(
            "div"
        );


    track.style.display =
        "flex";


    track.style.alignItems =
        "flex-start";


    track.style.justifyContent =
        "center";


    track.style.width =
        "max-content";


    track.style.minWidth =
        "100%";


    track.style.margin =
        "0 auto";



    // ==========================================
    // ADD GANTT BLOCKS
    // ==========================================

    gantt.forEach(
        block => {


            const wrapper =
                document.createElement(
                    "div"
                );


            const duration =
                block.end -
                block.start;



            // Width based on duration

            wrapper.style.width =
                Math.max(

                    70,

                    duration * 45

                ) + "px";

            wrapper.style.flexShrink =
                "0";
            wrapper.style.textAlign =
                "center";
            // PROCESS BOX
            const box =
                document.createElement(
                    "div"
                );
            box.className =
                "process-box";
            box.textContent =
                block.id;
            box.style.width =
                "100%";
            box.style.boxSizing =
                "border-box";
            wrapper.appendChild(
                box
            );
            // TIME
            const timeLabel =
                document.createElement(
                    "div"
                );
            timeLabel.textContent =
                block.start +
                " - " +
                block.end;
            timeLabel.style.marginTop =
                "6px";
            timeLabel.style.fontSize =
                "12px";
            timeLabel.style.color =
                "#64748b";
            wrapper.appendChild(
                timeLabel
            );
            track.appendChild(
                wrapper
            );

        }
    );



    // Put track inside chart

    chart.appendChild(
        track
    );

}
// SHOW READY QUEUE
function showQueue(gantt) {
    const queue =
        $("readyQueue");
    queue.innerHTML = "";
    gantt
        .filter(
            block =>
                block.id !== "Idle"
        )
        .forEach(
            block => {
                queue.innerHTML += `
                    <div class="process-box">
                        ${block.id}
                    </div>
                `;
            }
        );
}
// INITIAL QUEUE
function showInitialQueue() {
    const queue =
        $("readyQueue");
    queue.innerHTML = "";
    document
        .querySelectorAll(
            ".pid"
        )
        .forEach(
            input => {
                if (
                    input.value.trim()
                ) {
                    queue.innerHTML += `
                        <div class="process-box">
                            ${input.value}
                        </div>
                    `;
                }
            }
        );
}
// CLEAR RESULTS
function clearResults() {
    $("resultsBody").innerHTML =
        "";
    $("avgWaiting").textContent =
        "—";
    $("avgTurnaround").textContent =
        "—";
    const chart =
        $("ganttChart");
    chart.innerHTML =
        "Gantt Chart will appear here";
    // Restore original chart styling
    chart.style.display =
        "";
    chart.style.width =
        "";
    chart.style.maxWidth =
        "";
    chart.style.overflowX =
        "";
    chart.style.overflowY =
        "";
    chart.style.boxSizing =
        "";
    chart.style.padding =
        "";
    chart.style.whiteSpace =
        "";
}
// RESET
function reset() {
    $("quantum").value =
        2;
    $("processCount").value =
        4;
    createProcesses();
}
// FORMAT NUMBER
function format(number) {
    return Number.isInteger(number)
        ? number
        : number.toFixed(2);
}
// BUTTON EVENTS
$("updateProcessesButton")
    .onclick =
    createProcesses;
$("runButton")
    .onclick =
    runRoundRobin;
$("resetButton")
    .onclick =
    reset;
// INITIAL LOAD
showInitialQueue();