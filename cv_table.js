/* ============================================================================
 * cv_table.js
 *
 * Adds a "Timeline  /  Table" view toggle to the CV, and a tabular renderer
 * that lays the same education.yml data out in a traditional Canadian
 * academic-CV format, in the spirit of the BCGSC "Master CV" template.
 *
 * Date handling in the table view:
 *   - Range entries (start/end) show the start and end stacked on two lines,
 *     each as "Mon YYYY", to keep the date column narrow.
 *   - Event entries (single date) are grouped under a single YEAR label, with
 *     MONTHS nested beneath; a month shared by several items is labelled once.
 *   - Publications/talks are numbered forwards (1 at the top, counting up).
 *
 * The timeline rendering (cv_timeline.js) is left untouched; this file simply
 * decides which renderer to run and re-renders #content + #toc on toggle.
 * ==========================================================================*/

(function () {
    var CV_RAW = null;          // raw YAML text, re-parsed on each render
    var CV_VIEW = 'timeline';   // 'timeline' | 'table'
    var STORAGE_KEY = 'cv_view_preference';

    var MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /* ---------------------------------------------------------------- entry
     * helpers (mirror the visibility / classification logic in the timeline)
     * ---------------------------------------------------------------------*/
    function isVisibleSubsection(ss) { return !(ss.display && ss.display.hidden); }
    function isVisibleEntry(e) { return !e.hidden; }
    function isCitation(e) { return ('authors' in e) || ('journal' in e); }
    function hasBlockText(e) { return ('description' in e) || ('title' in e); }
    function isRange(e) { return ('start' in e) && ('end' in e); }

    function yearOf(s) {
        if (s === 'present') { return new Date().getFullYear(); }
        return Number(String(s).split('-')[0]);
    }
    function monthIndexOf(s) {
        if (s === 'present') { return 0; }
        var p = String(s).split('-');
        return Number(p[1]) || 0;
    }
    function monYear(s) {
        if (s === 'present') { return 'present'; }
        var m = monthIndexOf(s);
        return (m ? MONTHS[m] + ' ' : '') + yearOf(s);
    }
    function timeOf(s) {
        if (s === 'present') { return Date.now(); }
        var p = String(s).split('-').map(Number);
        return new Date(p[0], (p[1] || 1) - 1, p[2] || 1).getTime();
    }

    // Most-recent-first sort key, matching the timeline's reverse-chronological feel.
    function entrySortKey(e) {
        if ('end' in e) { return timeOf(e.end); }
        if ('start' in e) { return timeOf(e.start); }
        if ('date' in e) { return timeOf(e.date); }
        return 0;
    }

    // Two-line date cell for a range entry: "Mon YYYY \u2013" over "Mon YYYY"/"present".
    function rangeDateHtml(e) {
        var endTxt = (e.end === 'present') ? 'present' : monYear(e.end);
        return '<span class="cv-d-start">' + monYear(e.start) + ' \u2013</span>' +
            '<span class="cv-d-end">' + endTxt + '</span>';
    }

    function collapse(s) { return (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim(); }
    function stripTrailingPeriods(s) { return collapse(s).replace(/\.+$/, '').trim(); }
    function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

    /* ----------------------------------------------------------- rendering */

    function categoryTag(e) {
        if (!e.category) { return ''; }
        return '<span class="cv-cat">' + collapse(e.category) + '</span>';
    }

    // Inner HTML for a citation-style entry (peer-reviewed articles, invited
    // articles, conference talks) -- WITHOUT the leading number; the caller
    // supplies the number so it can run forwards across the whole subsection.
    function citationInner(e) {
        var authors = stripTrailingPeriods(e.authors);
        var titleHtml = '<em class="cv-cite-title">' + stripTrailingPeriods(e.title) + '.</em>';
        var year = ('date' in e) ? yearOf(e.date) : '';
        var venue = collapse(e.journal);
        var venueHtml = '<span class="entry-title cv-cite-venue">' + venue +
            (year !== '' ? ' (' + year + ')' : '') + ';</span>';
        var details = collapse(e.ref_details);

        var inner = (authors ? authors + '. ' : '') + titleHtml + ' ' + venueHtml +
            (details ? ' ' + details : '');

        if (e.url) {
            inner = '<a class="entry-title-link cv-cite-link" target="_blank" rel="noopener" ' +
                'href="' + escapeAttr(e.url) + '">' + inner + '</a>';
        }
        return inner + categoryTag(e);
    }

    // Right-hand content for a block-style entry (degrees, positions, awards,
    // grants, committees, talks without a citation).
    function blockBody(e) {
        var title = collapse(e.title);
        var desc = collapse(e.description);

        // Fall back to the timeline "brief" label when an entry carries no prose
        // (e.g. repeated conference rows) so nothing is silently dropped.
        if (!title && !desc && e.brief) { title = collapse(e.brief); }

        var titleHtml = '';
        if (title) {
            var t = e.url ? stripTrailingPeriods(title) : title;
            if (e.url) {
                titleHtml = '<a class="entry-title-link" target="_blank" rel="noopener" href="' +
                    escapeAttr(e.url) + '">' + t + '</a>';
            } else {
                titleHtml = '<span class="entry-title">' + t + '</span>';
            }
        }

        var html = '';
        if (titleHtml) {
            html += '<div class="cv-block-head">' + titleHtml + categoryTag(e) + '</div>';
        } else if (e.category) {
            html += '<div class="cv-block-head">' + categoryTag(e) + '</div>';
        }
        if (desc) { html += '<div class="description-text cv-desc">' + desc + '</div>'; }
        return html;
    }

    function eventItemHtml(e, number) {
        if (isCitation(e)) {
            return '<div class="cv-event cv-event-cite">' +
                '<span class="cv-num">' + number + '.</span>' +
                '<span class="cv-cite">' + citationInner(e) + '</span></div>';
        }
        return '<div class="cv-event">' + blockBody(e) + '</div>';
    }

    function renderSubsection($section, ss) {
        var entries = (ss.entries || []).filter(isVisibleEntry).slice();
        entries.sort(function (a, b) { return entrySortKey(b) - entrySortKey(a); });

        var ssId = sanitizeString(ss.title.trim()).replace(/ /g, '-');
        $section.append(
            '<h2 class="subsection-title-bare cv-subsection-title" id="' + ssId + '">' +
            collapse(ss.title) + '</h2>'
        );

        // Forward citation numbering: 1 at the top of the subsection, counting up.
        var citeNo = 0;

        // Open containers for the nested year -> month -> item event layout.
        var $events = null, curYear = null, curMonth = null,
            $yearBody = null, $monthBody = null;

        function resetGroups() {
            $events = null; curYear = null; curMonth = null;
            $yearBody = null; $monthBody = null;
        }
        function ensureEvents() {
            if (!$events) {
                $events = $('<div class="cv-events"></div>');
                $section.append($events);
            }
        }

        entries.forEach(function (e) {
            if (isRange(e)) {
                resetGroups(); // a range row breaks any open event grouping
                $section.append(
                    '<div class="cv-row cv-row-range">' +
                    '<div class="cv-date cv-date-range">' + rangeDateHtml(e) + '</div>' +
                    '<div class="cv-body">' + blockBody(e) + '</div>' +
                    '</div>'
                );
                return;
            }

            // ---- event entry: nest under year, then month ----
            ensureEvents();
            var y = ('date' in e) ? yearOf(e.date) : '';
            var m = ('date' in e) ? monthIndexOf(e.date) : 0;

            if (String(y) !== String(curYear)) {
                curYear = y; curMonth = null;
                var $yg = $('<div class="cv-year-group"></div>');
                $yg.append('<div class="cv-year">' + (y !== '' ? y : '') + '</div>');
                $yearBody = $('<div class="cv-year-body"></div>');
                $yg.append($yearBody);
                $events.append($yg);
            }
            if (m !== curMonth) {
                curMonth = m;
                var $mg = $('<div class="cv-month-group"></div>');
                $mg.append('<div class="cv-month">' + (m ? MONTHS[m] : '') + '</div>');
                $monthBody = $('<div class="cv-month-body"></div>');
                $mg.append($monthBody);
                $yearBody.append($mg);
            }

            var number = '';
            if (isCitation(e)) { citeNo += 1; number = citeNo; }
            $monthBody.append(eventItemHtml(e, number));
        });
    }

    function renderSection(sectionData) {
        var sectionId = sanitizeString(sectionData.title).replace(/ /g, '-');

        $('#content').append(
            '<h1 class="section-title cv-section-title" id="' + sectionId + '-title">' +
            sectionData.title.trim() + '</h1>' +
            '<div class="section-title-underline" id="' + sectionId + '-title-underline"></div>' +
            '<div class="section" id="' + sectionId + '"></div>'
        );

        if (sectionData.display && sectionData.display['background-color']) {
            $('#' + sectionId + '-title-underline')
                .css('border-top-color', sectionData.display['background-color']);
        }

        var $section = $('#' + sectionId);
        sectionData.subsections.forEach(function (ss) {
            if (!isVisibleSubsection(ss)) { return; }
            renderSubsection($section, ss);
        });
    }

    function plot_table(result) {
        var data = jsyaml.load(result);
        populate_contact_data(data['contact']);
        data['sections'].forEach(renderSection);
        rebuild_toc();
    }

    /* ------------------------------------------------------------- toc / ui */

    function rebuild_toc() {
        // tocify reads #content and writes its nested list into #toc; empty first
        // so repeated toggles don't stack duplicate lists.
        $('#toc').empty();
        $(function () { $('#toc').tocify({ extendPage: false }); });
    }

    function injectToggle() {
        if (document.getElementById('view-toggle')) { return; }
        var $toggle = $(
            '<div id="view-toggle" class="no-print" role="group" aria-label="CV view">' +
            '  <button type="button" data-view="timeline">Timeline</button>' +
            '  <button type="button" data-view="table">Table</button>' +
            '</div>'
        );
        $('body').append($toggle);
        $toggle.on('click', 'button', function () {
            setView($(this).attr('data-view'));
        });
        updateToggleUI();
    }

    function updateToggleUI() {
        $('#view-toggle button').each(function () {
            $(this).toggleClass('active', $(this).attr('data-view') === CV_VIEW);
        });
    }

    /* ------------------------------------------------------------ controller */

    function renderCurrentView() {
        $('#content').empty();
        $('#toc').empty();
        // <title> is managed once in init_cv, so contact rendering won't duplicate it.
        if (CV_VIEW === 'table') {
            plot_table(CV_RAW);
        } else {
            plot_timeline(CV_RAW); // existing D3 renderer (also builds its own toc)
        }
        updateToggleUI();
        if (typeof window.scrollTo === 'function') {
            try { window.scrollTo(0, 0); } catch (err) { /* ignore */ }
        }
    }

    function setView(view) {
        if (view !== 'timeline' && view !== 'table') { return; }
        if (view === CV_VIEW) { return; }
        CV_VIEW = view;
        try { localStorage.setItem(STORAGE_KEY, view); } catch (err) { /* ignore */ }
        renderCurrentView();
    }

    // New AJAX success handler (replaces the direct call to plot_timeline).
    function init_cv(result) {
        CV_RAW = result;
        document.title = 'Eric Stutheit-Zhao - CV';
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'timeline' || saved === 'table') { CV_VIEW = saved; }
        } catch (err) { /* ignore */ }
        injectToggle();
        renderCurrentView();
    }

    // expose
    window.init_cv = init_cv;
    window.set_cv_view = setView;
    window.plot_table = plot_table;
})();
