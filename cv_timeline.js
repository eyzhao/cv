const HIGHLIGHT_COLOR = '#FFF999'
const TEXT_Y_OFFSET = 0

function sanitizeString(str){
    str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
    return str.trim();
}

plot_timeline = function(result) { 
    console.log('starting')
    var data = jsyaml.load(result)
    console.log(data)

    populate_contact_data(data['contact']);

    data['sections'].map((section_data, index) => {
        var section_id = write_section(section_data, index);

        for (let subsection_data of section_data['subsections']) {
            if ('hidden' in subsection_data.display) {
                if (subsection_data.display.hidden) {
                    continue
                }
            }
            
            var subsection_id = write_subsection(subsection_data, section_id)
            console.log(subsection_id)
        }
    })

    console.log('finished, and writing toc')
    $(function() {
        $("#toc").tocify({
            extendPage: false
        })
    });
}

populate_contact_data = function(contact_data) {
    $('#content')
        .append(`
            <div id='contact'>
                <div id='photo'>
                    <img src="${contact_data['photo']}">
                </div>
                <div id='idbox'>
                    <div id='name'>
                        ${contact_data['name']}<span id='credentials'>, ${contact_data['credentials']}</span>
                    </div>
                    <div id='title'>
                        ${contact_data['title']}
                    </div>
                    <div>
                        ${contact_data['email']} <span class='emph'>/</span> ${contact_data['website']}
                    </div>
                    <div id='blurb'>
                        ${contact_data['blurb']}
                    </div>
                </div>
            </div>
        `)

    $('title')
        .append(`
            Eric Y. Zhao - Curriculum Vitae
        `)
}

function draw_highlights(entries, svg_container, highlights_group) {
    var highlights = []
    var entries_highlight_idx = entries.map((entry, i) => {
        if (entry.highlight) { return(i) }
    }).filter(entry => {
        return(entry != null)
    })

    console.log(entries_highlight_idx)
    console.log(svg_container.selectAll('.timeline-brief')._groups[0])
    svg_container.selectAll('.timeline-brief')._groups[0].forEach((tb, i) => {
        if (entries_highlight_idx.includes(i)) {
            console.log(i)
            highlights.push(tb.getBBox())
        }
    })

    padding = {top: 0, bottom: 5, left: 3, right: 0}
    console.log(highlights)
    highlights_group.selectAll('.timeline-highlight')
        .data(highlights)
        .enter().append('rect')
            .attr('class', 'timeline-highlight')
            .attr('x', (d, i) => d['x'] - padding.left)
            .attr('y', (d, i) => d['y'] - padding.top)
            .attr('rx', 6)
            .attr('ry', 6)
            .attr('height', (d, i) => d['height'] + padding.left + padding.right)
            .attr('width', (d, i) => d['width'] + padding.top + padding.bottom)
            .attr('fill', HIGHLIGHT_COLOR)
}

write_section = function(section_data, index) {
    section_id = sanitizeString(section_data.title)
        .replace(/ /g, '-')

    if ('pagebreak' in section_data.display) {
        if (section_data.display.pagebreak) {
            $('#content')
                .append(`
                    <div class="pagebreak"></div>
                `)
        }
    }

    $('#content')
        .append(`
            <h1 class='section-title' id="${section_id}-title">${section_data.title.trim()}</h1>
            <div class='section-title-underline' id='${section_id}-title-underline'>
            </div>
        `)
        .append(`
            <div class='section' id="${section_id}">
            </div>
        `)

    if ('display' in section_data) {
        if ('background-color' in section_data.display) {
            $(`#${section_id}-title-underline`).css('border-top-color', section_data.display['background-color']);
        }
    }

    return(section_id);
}

write_subsection = function(subsection_data, section_id) {
    subsection_data['entries'] = subsection_data['entries'].filter((elem, pos, arr) => {
        if ('hidden' in elem) {
            return(! elem.hidden)
        } else {
            return(true)
        }
    })

    subsection_id = sanitizeString(subsection_data['title'].trim())
        .replace(/ /g, '-')

    if ('pagebreak' in subsection_data.display) {
        if (subsection_data.display.pagebreak) {
            $(`#${section_id}`)
                .append(`<div class='pagebreak'></div>`)
        }
    }

    if (subsection_data['display']['type'] == 'bare') {
        $(`#${section_id}`)
            .append(`<div id="${subsection_id}" class="subsection-bare"></div>`)

        $(`#${subsection_id}`)
            .append(`
                <div
                    id="${subsection_id}-details"
                    class="details-bare ${subsection_data['display']['highlight'] ? 'highlight' : ''}" style='padding-top: 0px;'
                ></div>
            `)

        $(`#${subsection_id}-details`)
            .append(`
                <h2 class="subsection-title-bare ${subsection_data['display']['highlight'] ? 'highlight' : ''}">${subsection_data['title'].trim()}</h2>
                <div id="${subsection_id}-timeline" class="timeline"></div>
            `)
    } else {
        $(`#${section_id}`)
            .append(`<div id="${subsection_id}" class="subsection"></div>`)

        $(`#${subsection_id}`)
            .append(`
                <div id="${subsection_id}-left" class="timeline"></div>
            `)
            .append(`
                <div id="${subsection_id}-details" class='details' style='padding-top: 20px;'></div>
            `)

        $(`#${subsection_id}-details`)
            .append(`
                <div id="${subsection_id}-legend" class="legend"></div>
            `)

        $(`#${subsection_id}-left`)
            .append(`
                <h2 class="subsection-title ${subsection_data['display']['highlight'] ? 'highlight' : ''}">${subsection_data['title'].trim()}</h2>
                <div id="${subsection_id}-timeline" class="timeline"></div>
            `)

    }

    var subsection_title = document.createElement("span");
    subsection_title.innerHTML = subsection_data["title"];

    if (subsection_data['display']['type'] == 'nonoverlapping') {
        entries = nonoverlapping_timeline(subsection_data, subsection_id + '-timeline')
    } else if (subsection_data['display']['type'] == 'events') {
        entries = events_timeline(subsection_data, subsection_id + '-timeline', subsection_id + '-legend')
    } else if (subsection_data['display']['type'] == 'overlapping') {
        entries = overlapping_timeline(subsection_data, subsection_id + '-timeline')
    } else if (subsection_data['display']['type'] == 'bare') {
        entries = subsection_data['entries'];
    }

    if ('year_labels' in subsection_data.display) {
        show_year_labels = subsection_data.display['year_labels']
    } else {
        show_year_labels = false
    }

    fill_details(entries, subsection_id + '-details', year_labels = show_year_labels)

    return(subsection_id);
}

remove_period = function(str) {
    str = str.trim()
    if (str[str.length-1] === ".") {
        str = str.slice(0,-1);
    }
    return(str.trim())
}

fill_details = function(entries, element_id, year_labels) {
    for (const [index, entry_data] of entries.entries()) {
        if ('new_year' in entry_data) {
            if (entry_data['new_year'] && year_labels) {
                year = entry_data['date'].getFullYear()
                $(`#${element_id}`)
                    .append(`
                        <div class='year-label'>
                            ${year}
                        </div>
                    `)
            }
        }

        if ('date' in entry_data) {
            formatted_date = new Date(entry_data['date']).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            date_text = formatted_date
        } else if ('start' in entry_data & 'end' in entry_data) {
            formatted_date_1 = new Date(entry_data['start']).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            formatted_date_2 = new Date(entry_data['end']).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            date_text = formatted_date_1 + ' - ' + formatted_date_2
        } else {
            date_text = ""
        }

        if ('authors' in entry_data || 'journal' in entry_data) {
            if (entry_data['date'] == 'present') {
                year_label = ''
            } else {
                year_label = entry_data['date'].getFullYear()
            }

            if ('ref_details' in entry_data) {
                ref_details_text = entry_data['ref_details']
            } else {
                ref_details_text = ""
            }
            
            $(`#${element_id}`)
                .append(`
                    <div class="entry">
                        <div class="entry-text ${entry_data['highlight'] ? 'highlight' : 'nohighlight'}">
                            ${remove_period(entry_data['authors'])}.

                            <${entry_data['url'] ? 'a' : 'span'}
                                href="${entry_data['url'] ? entry_data['url'] : '#'}"
                                class="${entry_data['url'] ? 'entry-title-link' : 'entry-title-nolink'}">

                                <em>${remove_period(entry_data['title'])}.</em>
                                <span class="entry-title" id="${element_id}_${index}_title">
                                    ${entry_data['journal']} (${year_label});
                                </span>
                            </${entry_data['url'] ? 'a' : 'span'}>
                            ${ref_details_text}
                        </div>
                    </div>
                `)
        } else if ('description' in entry_data || 'title' in entry_data) {
            if (entry_data['url']) {
                while (entry_data['title'].charAt(entry_data['title'].length - 1) == '.') {
                    entry_data['title'] = entry_data['title'].substring(0, entry_data['title'].length - 1);
                }
            }

            if (entry_data['description']) {
                description_text = entry_data['description']
            } else {
                description_text = ''
            }

            $(`#${element_id}`)
                .append(`
                    <div class="entry">

                        <div class="entry-text ${entry_data['highlight'] ? 'highlight' : 'nohighlight'}">
                            <div class="title-date">
                                <${entry_data['url'] ? 'a' : 'span'}
                                    href="${entry_data['url'] ? entry_data['url'] : '#'}"
                                    class="${entry_data['url'] ? 'entry-title-link' : 'entry-title-nolink'}">

                                    <span class="entry-title" id="${element_id}_${index}_title">
                                        ${entry_data['title']}
                                    </span>
                                </a>
                                <span class="date-text">
                                    ${date_text}
                                </span>
                            </div>
                            <div class="description-text">
                                ${description_text}
                            </div>
                        </div>
                    </div>
                `)
        } 

        if (entry_data['url']) {
            $(`#${element_id}_${index}_title`)
                .append(`
                    <span class='entry-link'>
                        <img src='images/link_icon.svg' width='11px' />
                    </span>
                `)
        }

    }
}

parse_entry_dates = function(entry) {
    var to_date = d3.timeParse("%Y-%m-%d");

    if ('start' in entry && 'end' in entry) {
        entry['start'] = to_date(entry['start']);
        if (entry['end'] == 'present') {
            entry['end'] = new Date();
        } else {
            entry['end'] = to_date(entry['end'])
        }
    } else if ('date' in entry) {
        if (entry['date'] == 'present') {
            entry['date'] = new Date();
        } else {
            entry['date'] = to_date(entry['date'])
        }
    }

    return(entry);
}

overlapping_timeline = function(data, element_id) {
    height = data['entries'].length * 50;

    entries = data['entries'];
    entries = entries.map(parse_entry_dates)

    entries = entries.sort(function(a, b) {
        return(b['start'] - a['start'])
    });

    var min_date = d3.min(entries.map(e => { return(e['start']) })),
        max_date = d3.max(entries.map(e => { return(e['end']) })),
        year_range = max_date.getFullYear() - min_date.getFullYear()

    var svg_container = d3.select('div#' + element_id)
        .append('svg')
        .attr('id', 'svg-' + element_id)
        .attr('width', 300)
        .attr('height', height);

    var x_scale = d3.scaleBand().rangeRound([0, 10]).padding(0.1),
        y_scale = d3.scaleTime()
                .domain([min_date, max_date])
                .range([height-10, 10])

    svg_container.selectAll('.timeline-block')
        .data(data['entries'])
        .enter().append('rect')
            .attr('class', 'timeline-block')
            .attr('x', (d, i) => {
                return(60 + (i % 8) * 4);
            })
            .attr('y', (d) => {
                return(y_scale(d['end']));
            })
            .attr('width', 1.5)
            .attr('height', d => {
                return(y_scale(d['start']) - y_scale(d['end']))
            })
            .attr('fill', '#387EB9')

    highlights_group = svg_container.append('g')
        .attr('class', 'highlights')

    svg_container.selectAll('.timeline-brief')
        .data(data['entries'])
        .enter()
        .append('text')
            .attr('class', 'timeline-brief')
            .attr('x', 100)
            .attr('y', (d, i) => {
                return(height - (i * 50) + TEXT_Y_OFFSET - 40);
            })
            .attr('alignment-baseline', 'hanging')
            .text((d) => { return(d['brief']) })
            .call(wrap, 180)

    draw_highlights(data['entries'], svg_container, highlights_group)

    svg_container.selectAll('.timeline-label-lines')
        .data(data['entries'])
        .enter().append('path')
            .attr('d', (d, i) => {
                var x = 100 - 5,
                    y = height - (50 * i) - 30,
                    new_x = 60 + (i % 8) * 4;

                new_y = get_label_intersect(d, y, y_scale)

                return(`M${x},${y}L${new_x},${new_y}`)
            })
            .attr('stroke', 'black')

    svg_container.selectAll('.timeline-intersect-points')
        .data(data['entries'])
        .enter().append('circle')
            .attr('cx', (d, i) => { return(60 + (i % 8) * 4 + 1) })
            .attr('cy', (d, i) => {
                y = height - (50 * i) - 30;
                return(get_label_intersect(d, y, y_scale))
            })
            .attr('r', 2.5)
            .attr('fill', 'black')

    console.log(Math.round(year_range / height * 35))
    var y_axis = d3.axisLeft()
        .scale(y_scale)
        .ticks(d3.timeYear.every(Math.max(Math.round(year_range / height * 25), 1)))

    svg_container.append("g")
        .attr("class", "timeline-years")   // give it a class so it can be used to select only xaxis labels  below
        .attr("transform", "translate(60,0)")
        .call(y_axis);

    return(entries)
}

get_label_intersect = function(d, y, y_scale) {
    if (y < y_scale(d['start']) && y > y_scale(d['end'])) {
        return(y)
    } else if (y > y_scale(d['start'])) {
        return(y_scale(d['start']) + 0.01 * (y_scale(d['end']) - y_scale(d['start'])))
    } else {
        return(y_scale(d['end']) - 0.01 * (y_scale(d['end']) - y_scale(d['start'])))
    }
}

nonoverlapping_timeline = function(data, element_id) {
    var svg_container = d3.select('div#' + element_id)
        .append('svg')
        .attr('id', 'svg-' + element_id)
        .attr('width', 300)
        .attr('height', 150);

    var x = d3.scaleBand().rangeRound([0, 10]).padding(0.1),
        y = d3.scaleLinear().rangeRound([300, 0])

    y.domain([0, 2]);

    svg_container.selectAll('.timeline-block')
        .data(data['entries'])
        .enter().append('rect')
            .attr('class', 'timeline-block')
            .attr('x', 80)
            .attr('y', (d, i) => {
                position = i * 50;
                return(position)
            })
            .attr('width', 12)
            .attr('height', 40)
            .attr('fill', '#387EB9')

    highlights_group = svg_container.append('g')
        .attr('class', 'highlights')

    svg_container.selectAll('.timeline-brief')
        .data(data['entries'])
        .enter().append('text')
            .attr('class', 'timeline-brief')
            .attr('x', 100)
            .attr('y', (d, i) => {
                position = i * 50 + TEXT_Y_OFFSET;
                return(position)
            })
            .attr('alignment-baseline', 'hanging')
            .text((d) => { return(d['brief']) })

    draw_highlights(data['entries'], svg_container, highlights_group)

    svg_container.selectAll('.timeline-years')
        .data(data['entries'])
        .enter().append('text')
            .attr('class', 'timeline-years')
            .attr('x', 70)
            .attr('y', (d, i) => {
                position = i * 50;
                return(position)
            })
            .attr('alignment-baseline', 'hanging')
            .attr('text-anchor', 'end')
            .text((d) => {
                return(d['start'].split('-')[0])
            })

    fit_height('svg-' + element_id);
    return(data['entries'])
}

events_timeline = function(data, element_id, legend_id) {
    entries = data['entries'];

    entries = entries
        .map(parse_entry_dates)
        .sort(function(a, b) {
            return(b['date'] - a['date'])
        })

    entries = entries
        .map((entry, index) => {
            if (! entry['title'] && ! entry['description']) {
                // If entry will not appear in text description, then no need for a new year label before it
                entry['new_year'] = false
            } else if (index == 0) {
                entry['new_year'] = true
            } else if (entry.date.getFullYear() != entries[index - 1].date.getFullYear()) {
                entry['new_year'] = true
            } else {
                entry['new_year'] = false
            }
            return(entry)
        })

    unique_categories = entries.map(entry => {
        return(entry['category'])
    }).filter((elem, pos, arr) => {
        return (arr.indexOf(elem) == pos);
    }).sort();;

    pagebreak_indices = entries.map((entry, index) => {
        if (index == 0) {
            return(index)
        } else if ('pagebreak' in entry) {
            if ('pagebreak' in entry) {
                if (entry.pagebreak) {
                    return(index)
                }
            }
        }
    }).filter(value => {
        return(!isNaN(value))
    });
    pagebreak_indices.push(entries.length);

    for (page_index = 0; page_index < pagebreak_indices.length - 1; page_index++) {
        var entries_slice = entries.slice(pagebreak_indices[page_index], pagebreak_indices[page_index + 1]);

        for (i = 0; i < entries_slice.length; i++) {
            if (i == 0) {
                if (page_index > 0) {
                    entries_slice[i]['dy'] = 1;
                } else {
                    entries_slice[i]['dy'] = 0;
                }
            } else {
                entries_slice[i]['dy'] = entries_slice[i-1]['dy'] + Math.floor(entries_slice[i-1]['brief'].length / 18);
            }

            if (i == 0) {
                entries_slice[i]['show_year'] = true;
            } else if (entries_slice[i]['date'].getFullYear() == entries_slice[i-1]['date'].getFullYear()) {
                entries_slice[i]['show_year'] = false;
            } else {
                entries_slice[i]['show_year'] = true;
                entries_slice[i]['dy'] += 1;
            }
        };

        if (page_index > 0) {
            $(`div#${element_id}`).append(`
                <div class="pagebreak"></div>
                <div class='subsection-continue'>${data.title} Continued</div>
            `)
        }

        var svg_container = d3.select('div#' + element_id)
            .append('svg')
            .attr('id', 'svg-' + element_id + '-page-' + String(page_index))
            .attr('width', 300)
            .attr('height', this.height);

        var x = d3.scaleBand().rangeRound([0, 10]).padding(0.1),
            y = d3.scaleLinear().rangeRound([300, 0]),
            brewer_colours = ["#377eb8","#4daf4a","#ff7f00","#ffff33","#a65628","#f781bf","#999999"],
            color = d3.scaleOrdinal()
              .domain(unique_categories)
              .range(brewer_colours.slice(0, unique_categories.length));

        y.domain([0, 2]);

        if (page_index == pagebreak_indices.length - 2) {
            var bottom_pad = 0
        } else {
            var bottom_pad = 20
        }

        svg_container.append('rect')
            .attr('class', 'timeline-background')
            .attr('x', 80)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', (entries_slice.length-1) * 30 + entries_slice[entries_slice.length-1]['dy'] * 20 + 12 + bottom_pad)
            .attr('fill', '#B3CDE2')

        svg_container.selectAll('.timeline-block')
            .data(entries_slice)
            .enter().append('rect')
                .attr('class', 'timeline-block')
                .attr('x', 80)
                .attr('y', (d, i) => {
                    position = i * 30 + d['dy'] * 20;
                    return(position)
                })
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', d => {
                    return(color(d['category']))
                })

        highlights_group = svg_container.append('g')
            .attr('class', 'highlights')

        svg_container.selectAll('.timeline-brief')
            .data(entries_slice)
            .enter().append('text')
                .attr('class', 'timeline-brief')
                .attr('x', 100)
                .attr('y', (d, i) => {
                    position = i * 30 + d['dy'] * 20 + TEXT_Y_OFFSET;
                    return(position)
                })
                .attr('alignment-baseline', 'hanging')
                .text((d) => { return(d['brief']) })
                .call(wrap, 200)

        draw_highlights(entries_slice, svg_container, highlights_group)

        svg_container.selectAll('.timeline-years')
            .data(entries_slice)
            .enter().append('text')
                .attr('class', 'timeline-years')
                .attr('x', 70)
                .attr('y', (d, i) => {
                    position = i * 30 + d['dy'] * 20;
                    return(position)
                })
                .attr('alignment-baseline', 'hanging')
                .attr('text-anchor', 'end')
                .text((d) => {
                    if (d['show_year']) {
                        return(d['date'].getFullYear())
                    } else {
                        return('')
                    }
                })

        fit_height('svg-' + element_id + '-page-' + String(page_index));
    }


    var svg_legend = d3.select('div#' + legend_id)
        .append('svg')
        .attr('id', 'svg-legend-' + element_id)
        .attr('width', 300)
        .attr('height', this.height);

    svg_legend.selectAll('.legend-rect')
        .data(unique_categories)
        .enter().append('rect')
            .attr('class', 'legend-rect')
            .attr('x', 0)
            .attr('y', (d, i) => {
                return(i * 30)
            })
            .attr('height', 12)
            .attr('width', 12)
            .attr('fill', d => { return(color(d)) })

    svg_legend.selectAll('.legend-text')
        .data(unique_categories)
        .enter().append('text')
            .attr('class', 'legend-text')
            .attr('x', 20)
            .attr('y', (d, i) => {
                return(i * 30)
            })
            .attr('alignment-baseline', 'hanging')
            .text(d => { return(d) })

    fit_height('svg-legend-' + element_id)

    return(entries)
}

fit_height = function(svg_element_id) {
    var svg_element = document.getElementById(svg_element_id),
        bb = svg_element.getBBox();
    svg_element.style.height = bb.y + bb.height + 20;
}

wrap = function(text, width) {
    text.each(function() {
        var text = d3.select(this),
                words = text.text().split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.25, // ems
                x = text.attr("x"),
                y = text.attr("y")

        var tspan = text.text(null)
            .append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr('alignment-baseline', 'hanging');

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + "em")
                    .attr('alignment-baseline', 'hanging')
                    .text(word);
            }
        }
    });
}

