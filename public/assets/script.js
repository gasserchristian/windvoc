/**
 * List of functions:
 * - getFormTypeCheckboxes
 * - getFormTypeCheckboxe
 * - updateReducedModal
 * - updateLevel
 * - fetchHistogramLevel
 * - buildHistogramLevel
 * - updateHistogram
 * - initRangeSlider
 * - fyShuffle
 * - getLevelBounds
 * - isDef
 * - getLevelIncrementElement
 * - addParamsToUrl
 * - getDictAddUpdateModal
 */

wordType = {
    1: 'Noun',
    2: 'Adjective',
    3: 'Preposition',
    4: 'Verb',
    5: 'Adverb',
    6: 'Pronoun',
    7: 'Idiom',
    10: 'Default'
}

function getFormTypeCheckboxes() {
    let $wrapper = $('<div>')
    $wrapper.append(
        Object.entries(wordType).map(d => getFormTypeCheckboxe(...d))
    )
    return $wrapper
}

function getFormTypeCheckboxe(value,type) {
    let $item = $('<div>', { class: 'form-check form-check-inline' })
    $item.append(
        $('<input>',{
            class: 'form-check-input',
            type: 'radio',
            name: 'updateType',
            id: `inputType${type}`,
            value: value
        }),
        $('<label>',{
            class: 'form-check-label',
            for: `inputType${type}`,
            text: type
        })
    )
    return $item
}

// Handle PUT definition and content
function updateReducedModal(id, callback) {
    const content = $('#updateItemModalReduced #updateContent').val();
    const definition = $('#updateItemModalReduced #updateDefinition').val();
    const updatedItem = { content, definition }
    // Send PUT request to update front/rear side
    $.ajax({
        url: `voc/item/${id}`,
        type: 'PUT',
        data: JSON.stringify(updatedItem),
        contentType: 'application/json',
        success: function (response) {
            console.log(`Item ${id}: update content/definition`);
            callback();
            $('#updateItemModalReduced').modal('hide');
        }
    });
}

// Handle update level
function updateLevel(id, level, callback) {
    const updatedItem = { level }
    // Send PUT request to create new item
    $.ajax({
        url: `voc/item/${id}`,
        type: 'PUT',
        data: JSON.stringify(updatedItem),
        contentType: 'application/json',
        success: function (response) {
            console.log(`Item ${id}: level ${level}`);
            if(callback) callback()
        }
    });
}

// Build histogram
function fetchHistogramLevel() {
    $.ajax({
        url: './voc/level',
        method: 'GET',
        success: function (data) {
            dataset = data.map(d => d.level)
            const { lowerLevel, upperLevel } = getLevelBounds()
            buildHistogramLevel(
                dataset,
                lowerLevel,
                upperLevel
            );
            initRangeSlider(
                d3.min(dataset),
                d3.max(dataset),
                lowerLevel,
                upperLevel
            );
        }
    });
}
function buildHistogramLevel(data, lower, upper) {
    const minValue = d3.min(data, d => parseInt(d));
    const maxValue = d3.max(data, d => parseInt(d)) + 1;
    const binSize = 1;
    const histogramSvg = d3.select('.histogram');

    const histogramData = d3.histogram()
        .value(d => d)
        .domain([minValue, maxValue])
        .thresholds(d3.range(minValue, maxValue + binSize, binSize))(dataset);

    const xScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([0, 100]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(histogramData, d => d.length)])
        .range([30, 0]);

    const bars = histogramSvg.selectAll('.bar')
        .data(histogramData);

    bars.exit().remove();

    bars.enter()
        .append('rect')
        .attr('class', 'bar')
        .merge(bars)
        .attr('x', d => xScale(d.x0))
        .attr('y', d => yScale(d.length))
        .attr('width', d => xScale(d.x1) - xScale(d.x0))
        .attr('height', d => 100 - yScale(d.length))
        .attr('fill', '#4CAF50')

    let lowerValue = upper === undefined ? minValue : lower;
    let upperValue = upper === undefined ? maxValue : upper;

    updateHistogram(lowerValue, upperValue);
}
function updateHistogram(lower, upper) {
    const histogramSvg = d3.select('.histogram');
    histogramSvg.selectAll('.bar')
        .attr('fill', function (d) {
            if (d.x1 <= lower || d.x0 > upper)
                return '#ccc';
            return '#4CAF50';
        })
}

// Range slider for level
let isRangeSliderInitiated = false
function initRangeSlider(min, max, lower, upper) {
    const rangeSlider = document.querySelector('.range-slider');
    const rangeLine = document.querySelector('.range-line');
    const lowerHandle = document.querySelector('#lowerHandle');
    const upperHandle = document.querySelector('#upperHandle');
    const lowerValueInput = document.querySelector('#lowerLevel');
    const upperValueInput = document.querySelector('#upperLevel');
    const bars = d3.selectAll('.histogram .bar');

    // Set initial values
    let minValue = min;
    let maxValue = max;
    let lowerValue = lower === undefined ? min : Math.max(minValue, lower);
    let upperValue = upper === undefined ? max : Math.min(maxValue, upper);

    if (!isRangeSliderInitiated) {
        // Update the lower value
        lowerHandle.addEventListener('mousedown', () => {
            document.addEventListener('mousemove', handleLowerMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        lowerHandle.addEventListener('touchstart', () => {
            document.addEventListener('touchmove', handleLowerMove);
            document.addEventListener('touchend', handleMouseUp);
        });
        lowerValueInput.addEventListener('input', handleLowerInputChange);

        // Update the upper value
        upperHandle.addEventListener('mousedown', () => {
            document.addEventListener('mousemove', handleUpperMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        upperHandle.addEventListener('touchstart', () => {
            document.addEventListener('touchmove', handleUpperMove);
            document.addEventListener('touchend', handleMouseUp);
        });
        upperValueInput.addEventListener('input', handleUpperInputChange);

        // Update both lower and upper
        bars.on('click',(e,d)=>handleBarClick(d.x0))

        function handleLowerMove(event) {
            const range = maxValue - minValue + 1;
            const handleWidth = lowerHandle.offsetWidth;
            const sliderWidth = rangeSlider.offsetWidth;

            const minPosition = 0;
            const maxPosition = upperHandle.offsetLeft - Math.round(( sliderWidth / range));
            const position = Math.min(maxPosition, Math.max(minPosition, (event.clientX || event.touches[0].clientX) - rangeSlider.getBoundingClientRect().left - handleWidth / 2));
            const value = Math.round((position / sliderWidth) * range + minValue);

            lowerValue = value;
            updateHandlesHistogram();
            updateValuesInputs();
        }

        function handleUpperMove(event) {
            const range = maxValue - minValue;
            const handleWidth = upperHandle.offsetWidth;
            const sliderWidth = rangeSlider.offsetWidth;

            const minPosition = lowerHandle.offsetLeft;
            const maxPosition = sliderWidth;
            const position = Math.max(minPosition, Math.min(maxPosition, (event.clientX || event.touches[0].clientX) - rangeSlider.getBoundingClientRect().left - handleWidth / 2));
            const value = Math.round((position / sliderWidth) * range + minValue);

            upperValue = value;
            updateHandlesHistogram();
            updateValuesInputs();
        }

        function handleMouseUp() {
            document.removeEventListener('mousemove', handleLowerMove);
            document.removeEventListener('mousemove', handleUpperMove);
            document.removeEventListener('mouseup', handleMouseUp);

            document.removeEventListener('touchmove', handleLowerMove);
            document.removeEventListener('touchmove', handleUpperMove);
            document.removeEventListener('touchend', handleMouseUp);
        }

        function handleLowerInputChange() {
            let lowerInput = lowerValueInput.value
            let upperInput = upperValueInput.value
            let validValue = Math.max(lowerInput,minValue)
            if (validValue > upperInput) validValue = upperInput
            lowerValue = validValue;
            updateHandlesHistogram();
        }

        function handleUpperInputChange() {
            let lowerInput = lowerValueInput.value
            let upperInput = upperValueInput.value
            let validValue = Math.min(upperInput, maxValue)
            if (validValue < lowerInput) validValue = lowerInput
            upperValue = validValue;
            updateHandlesHistogram();
        }

        function handleBarClick(level) {
            lowerValue = level
            upperValue = level
            updateHandlesHistogram()
            updateValuesInputs()
        }
    }

    updateHandlesHistogram()
    updateValuesInputs()

    // Update the positions and values of the handles and inputs
    function updateHandlesHistogram() {
        const range = maxValue - minValue + 1;
        const lowerPosition = (lowerValue - minValue) / range * 100;
        const upperPosition = (upperValue - minValue + 1) / range * 100;

        lowerHandle.style.left = lowerPosition + '%';
        upperHandle.style.left = upperPosition + '%';
        rangeLine.style.left = lowerPosition + '%';
        rangeLine.style.width = (upperPosition - lowerPosition) + '%';
        updateHistogram(lowerValue, upperValue);
    }

    function updateValuesInputs() {
        lowerValueInput.value = lowerValue;
        upperValueInput.value = upperValue;
    }

    isRangeSliderInitiated = true;
}

// Shuffle function
function fyShuffle(arr) {
    let i = arr.length;
    while (--i > 0) {
        let randIndex = Math.floor(Math.random() * (i + 1));
        [arr[randIndex], arr[i]] = [arr[i], arr[randIndex]];
    }
    return arr;
}
// Get level bounds
function getLevelBounds() {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);
    const lowerLevel = parseInt(searchParams.get('lowerLevel'));
    const upperLevel = parseInt(searchParams.get('upperLevel'));
    if (isDef(lowerLevel) && isDef(upperLevel) && upperLevel >= lowerLevel) {
        return { lowerLevel, upperLevel }
    } else if (isDef(lowerLevel)) {
        return { lowerLevel }
    } else if (isDef(upperLevel)) {
        return { upperLevel }
    }
    return {}
}
// Is defined
function isDef(item) {
    return !(typeof item === undefined) && !isNaN(item)
}

// Get level increment element
function getLevelIncrementElement(id,level) {
    const increaseLevelButton = $('<button>', {
        type: 'button',
        text: '+',
        class: 'btn btn-outline-secondary increase',
        click: function () {
            updateLevel(id, ++level, d=>{
                levelManager.find('input').val(level)
            });
        }
    });
    const decreaseLevelButton = $('<button>', {
        type: 'button',
        text: '-',
        class: 'btn btn-outline-secondary decrease',
        click: function () {
            updateLevel(id, --level, d=>{
                levelManager.find('input').val(level)
            });
        }
    });
    const levelManager = $('<div>', { class: 'input-group' })
        .append($('<div>', { class: 'input-group-prepend' })
            .append(decreaseLevelButton))
        .append($('<input>', { type: 'text', class: 'form-control text-center number', value: level, readonly: '' }))
        .append($('<div>', { class: 'input-group-append' })
            .append(increaseLevelButton))
    return levelManager
}

function addParamsToUrl() {
    if ($('aside').length) { // Check if element with ID 'el' exists
        var params = window.location.search; // Get parameters from the URL of the current page
        $('aside').find('a').each(function () {
            var href = $(this).attr('href'); // Get the href attribute of the link

            // Remove existing parameters from the href
            var updatedHref = href.replace(/\?.*$/, '');

            // Append new parameters
            updatedHref += params;

            $(this).attr('href', updatedHref); // Update the href attribute with the modified URL
        })
    }
}

function initMenu() {
    var aside = $("aside");
    var backdrop = $(".backdrop");
    var hamburger = $("#hamburger");

    if (hamburger.length > 0) {
        hamburger.on("click", function () {
            backdrop.toggleClass("hidden");
            handleMenu()
        });

        backdrop.on("click", function () {
            backdrop.addClass("hidden");
            handleMenu()
        });
    }

    function handleMenu() {
        if (backdrop.hasClass("hidden")) {
            aside.remove("fixed bottom-0");
            aside.addClass("hidden");
        } else {
            aside.addClass("fixed bottom-0");
            aside.removeClass("hidden");
        }
    }
}

initMenu()

function getDictAddUpdateModal() {
    return `
    <!-- Update Item Modal -->
    <div id="updateItemModal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="updateItemModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="updateItemModalLabel"><span class="update">Update</span><span
                            class="create">Add</span> dictionary item</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="updateItemForm">
                        <div class="form-group">
                            <label for="updateContent">Content:</label>
                            <input type="text" class="form-control" id="updateContent" required>
                        </div>
                        <div class="form-group" id="form-group-checkboxes">
                            <label>Type:</label><br>
                        </div>
                        <div class="form-group">
                            <label for="updateLevel">Level:</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <button type="button" class="btn btn-outline-secondary"
                                        id="decreaseLevel">-</button>
                                </div>
                                <input type="text" class="form-control" id="updateLevel" required>
                                <div class="input-group-append">
                                    <button type="button" class="btn btn-outline-secondary"
                                        id="increaseLevel">+</button>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="updateDefinition">Definition:</label>
                            <textarea class="form-control" id="updateDefinition" rows="3" required></textarea>
                        </div>
                        <div class="form-group">
                            <label for="updateTags">Tags:</label>
                            <input type="text" class="form-control" id="updateTags">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" data-dismiss="modal">Cancel</button>
                    <button id="updateItemDictBtnModal" type="button" class="btn btn-danger update">Update</button>
                    <button id="createItemDictBtnModal" type="button" class="btn btn-danger create">Create</button>
                </div>
            </div>
        </div>
    </div>
    `
}
