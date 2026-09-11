#!/usr/bin/env python3
"""Render the editable content in content/ into the pages.

The team edits JSON through the admin page; this turns that JSON into real HTML
so the pages still work without JavaScript and search engines can read them.

Sections of the hand-written pages are marked like this:

    <!-- CMS:questions:start -->  ...replaced...  <!-- CMS:questions:end -->

Everything outside the markers is left exactly as written, so the design stays
in the hand-authored files and only the content is generated.

Run: python3 tools/build.py
"""
import html
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

TICK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        '<polyline points="20 6 9 17 4 12"/></svg>')


def load(name):
    with open(os.path.join('content', name), encoding='utf-8') as f:
        return json.load(f)


def esc(text):
    return html.escape(str(text), quote=True)


def replace_block(page, key, markup):
    """Swap whatever sits between the markers for freshly rendered markup."""
    start, end = f'<!-- CMS:{key}:start -->', f'<!-- CMS:{key}:end -->'
    pattern = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.S)
    if not pattern.search(page):
        sys.exit(f'marker CMS:{key} not found; add it to the page first')
    return pattern.sub(start + '\n' + markup + '\n        ' + end, page)


def pretty_date(iso):
    try:
        y, m, d = (int(n) for n in iso.split('-'))
        months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December']
        return f'{d} {months[m - 1]} {y}'
    except (ValueError, IndexError):
        return iso


def slugify(text):
    """A heading turned into something that can sit in a URL."""
    out = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return out or 'section'


def markdown(text):
    """Enough Markdown for a blog post: headings, paragraphs, bold, links, lists.

    Deliberately small. A full library would be another dependency for a team
    that only needs headings and paragraphs.
    """
    out, buffer = [], []

    def flush():
        if buffer:
            out.append('<p>' + inline(' '.join(buffer)) + '</p>')
            buffer.clear()

    def inline(t):
        t = esc(t)
        t = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', r'<a href="\2">\1</a>', t)
        t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
        return t

    lines = text.replace('\r\n', '\n').split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            flush()
        elif line.startswith('## '):
            flush()
            title = line[3:].strip()
            out.append(f'<h2 id="{slugify(title)}">' + inline(title) + '</h2>')
        elif line.startswith('### '):
            flush()
            out.append('<h3>' + inline(line[4:].strip()) + '</h3>')
        elif line.lstrip().startswith(('- ', '* ')):
            flush()
            items = []
            while i < len(lines) and lines[i].lstrip().startswith(('- ', '* ')):
                items.append('<li>' + inline(lines[i].lstrip()[2:].strip()) + '</li>')
                i += 1
            out.append('<ul>' + ''.join(items) + '</ul>')
            continue
        else:
            buffer.append(line.strip())
        i += 1
    flush()
    return '\n          '.join(out)


# ----------------------------------------------------------------- questions --

def render_questions():
    data = load('questions.json')
    rows = []
    for item in data['items']:
        rows.append(
            '        <div>\n'
            f'          <dt>{esc(item["question"])}</dt>\n'
            f'          <dd>{esc(item["answer"])}</dd>\n'
            '        </div>'
        )
    return '\n'.join(rows), data


def render_client_faq(data):
    """Every client question, in groups, on the FAQ page.

    Same accordion as the home page: a group is a list of questions with the
    first answer showing, so the page reads as a menu of questions rather than
    fourteen answers at once. Grouping is for the reader; the structured data
    flattens it again, because a FAQPage wants a flat list.
    """
    blocks = []
    for group in data['groups']:
        rows = []
        for item in group['items']:
            first = ' open' if not rows else ''
            rows.append(
                f'            <details class="faq-row"{first}>\n'
                '              <summary>\n'
                f'                <span class="faq-row__q">{esc(item["question"])}</span>\n'
                '                <span class="faq-row__mark" aria-hidden="true"></span>\n'
                '              </summary>\n'
                f'              <div class="faq-row__a"><p>{esc(item["answer"])}</p></div>\n'
                '            </details>')
        blocks.append(
            f'        <section class="faq-group" aria-labelledby="{esc(group["id"])}-h">\n'
            f'          <h3 class="faq-group__title" id="{esc(group["id"])}-h">{esc(group["title"])}</h3>\n'
            '          <div class="faq-accordion">\n' + '\n'.join(rows) + '\n          </div>\n'
            '        </section>')
    return '\n\n'.join(blocks)


def render_featured_faq(data):
    """The five on the home page: one from each group, plus the one everybody
    asks first.

    An accordion, with the first answer showing and the rest a tap away, so the
    section is a short list of questions rather than a wall of answers. Built
    on <details>, so it opens without JavaScript and a screen reader announces
    it as expandable on its own.
    """
    rows = []
    for group in data['groups']:
        for item in group['items']:
            if not item.get('featured'):
                continue
            first = ' open' if not rows else ''
            rows.append(
                f'          <details class="faq-row"{first}>\n'
                '            <summary>\n'
                f'              <span class="faq-row__q">{esc(item["question"])}</span>\n'
                '              <span class="faq-row__mark" aria-hidden="true"></span>\n'
                '            </summary>\n'
                f'            <div class="faq-row__a"><p>{esc(item["answer"])}</p></div>\n'
                '          </details>')
    return '        <div class="faq-accordion">\n' + '\n'.join(rows) + '\n        </div>'


def featured_pairs(data):
    return [(i['question'], i['answer'])
            for g in data['groups'] for i in g['items'] if i.get('featured')]


def faq_schema(pairs, url):
    """FAQPage structured data, built from the content rather than the markup."""
    if not pairs:
        return ''
    data = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": url + "#faq",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in pairs
        ],
    }
    return ('<script type="application/ld+json">\n'
            + json.dumps(data, indent=2, ensure_ascii=False) + '\n</script>')


def put_schema(page, markup):
    """Swap the FAQPage block in the head, leaving any other one alone."""
    if not markup:
        return page
    pattern = re.compile(
        r'<script type="application/ld\+json">\s*\{\s*"@context"[^<]*?"@type": "FAQPage".*?</script>',
        re.S)
    if pattern.search(page):
        return pattern.sub(markup, page, count=1)
    return page.replace('</head>', markup + '\n</head>', 1)


# --------------------------------------------------------------------- tips --

def render_tips():
    data = load('tips.json')
    cards = []
    for group in data['groups']:
        items = '\n'.join(
            f'            <li>{TICK}<span>{esc(i)}</span></li>' for i in group['items'])
        cards.append(
            f'        <section class="card" id="{esc(group["id"])}" aria-labelledby="{esc(group["id"])}-h">\n'
            f'          <h3 id="{esc(group["id"])}-h">{esc(group["title"])}</h3>\n'
            '          <ul class="ticks">\n' + items + '\n          </ul>\n'
            '        </section>'
        )
    toc = '\n'.join(
        f'          <li><a href="#{esc(g["id"])}">{esc(g["title"])}</a></li>'
        for g in data['groups'])
    return '\n\n'.join(cards), toc, data


def youtube_id(url):
    """Pull the video id out of whichever YouTube URL shape somebody pasted."""
    if not url:
        return ''
    for pattern in (r'[?&]v=([\w-]{6,})', r'youtu\.be/([\w-]{6,})',
                    r'/embed/([\w-]{6,})', r'/shorts/([\w-]{6,})'):
        found = re.search(pattern, url)
        if found:
            return found.group(1)
    return ''


def render_video(data):
    """The tutorial video, and a way through to the rest of them.

    Uses youtube-nocookie so that simply reading the page does not hand the
    reviewer's browsing to an advertising cookie before they press play.
    """
    vid = youtube_id((data.get('videoUrl') or '').strip())
    channel = (data.get('channelUrl') or '').strip()
    if not vid and not channel:
        return '      <!-- No video set yet. Add one in the editor. -->'

    parts = ['      <div class="tips-video">']
    if vid:
        title = esc(data.get('videoTitle') or 'Personal Paparazzi tutorial')
        parts += [
            '        <div class="tips-video__frame">',
            f'          <iframe src="https://www.youtube-nocookie.com/embed/{esc(vid)}"',
            f'                  title="{title}" loading="lazy" allowfullscreen',
            '                  referrerpolicy="strict-origin-when-cross-origin"',
            '                  allow="accelerometer; clipboard-write; encrypted-media; '
            'gyroscope; picture-in-picture"></iframe>',
            '        </div>',
        ]
    if channel:
        parts += [
            '        <p class="tips-video__more">',
            f'          <a class="btn btn--primary" href="{esc(channel)}" target="_blank" '
            'rel="noopener">More tutorials on YouTube</a>',
            '        </p>',
        ]
    parts.append('      </div>')
    return '\n'.join(parts)


def render_places():
    """Where a photographer will be working, and how busy each place is.

    The dropdown shows how many people visit, which is a published fact.
    It does not show sessions an hour, because that would be a promise we
    cannot make: the reader sets that number themselves.

    Two dropdowns: the city first, then the spot. The spot list only makes
    sense once a launch city is chosen, so the page hides it for anywhere
    else and falls back to a plain, unremarkable stretch of a few sessions
    an hour. Ordered busiest first, which is how the client asked for it.
    The sessions an hour are an estimate drawn from the footfall figures,
    not a measurement, and the page says so.
    """
    data = load('places.json')
    city = data['city']

    options = []
    for i, place in enumerate(data['places']):
        selected = ' selected' if i == 0 else ''
        foot = place.get('footfall', '')
        label = esc(place['name']) + (f' &mdash; {esc(foot)}' if foot else '')
        options.append(f'                  <option value="{esc(place["id"])}"{selected}>{label}</option>')

    block = (
        '          <div class="field">\n'
        '            <label for="calc-city">Where will you be?</label>\n'
        '            <div class="field__select">\n'
        '              <select id="calc-city" name="city">\n'
        f'                <option value="{esc(city.lower())}" selected>{esc(city)}</option>\n'
        '                <option value="other">Somewhere else</option>\n'
        '              </select>\n'
        '            </div>\n'
        '          </div>\n'
        '\n'
        '          <div class="field" id="calc-place-field">\n'
        f'            <label for="calc-place">Whereabouts in {esc(city)}?</label>\n'
        '            <div class="field__select">\n'
        '              <select id="calc-place" name="place">\n'
        + '\n'.join(options) + '\n'
        '              </select>\n'
        '            </div>\n'
        '            <p class="field__note" id="calc-place-note"></p>\n'
        '          </div>'
    )

    payload = json.dumps({'city': city, 'places': data['places']}, ensure_ascii=False)
    script = ('        <script type="application/json" id="places-data">\n'
              f'          {payload}\n'
              '        </script>')
    return block, script, data


# --------------------------------------------------------------------- blog --

def render_blog_cards(posts, limit=None, prefix='blog/', names=None):
    """A card per post.

    Al asked for more visual interest, using his own blog as the reference:
    a picture, a category, the title, the summary, and the date with a read
    time. We have no photography yet, so each card carries a drawn cover
    instead of an empty space: nine squares, because nine photos and a short
    video is the product. The moment a real photograph exists for a post, the
    `image` field replaces the drawing with no further change.
    """
    names = names or {}
    cards = []
    for post in posts[:limit] if limit else posts:
        cat = post.get('category', 'client')
        tag = names.get(cat, '')
        image = (post.get('image') or '').strip()
        href = f'{prefix}{esc(post["slug"])}.html'

        if image:
            cover = (f'          <a class="post__cover" href="{href}" tabindex="-1" aria-hidden="true">\n'
                     f'            <img src="{esc(image)}" alt="" width="480" height="270" loading="lazy">\n'
                     '          </a>')
        else:
            # Six drawn covers, cycled, so a grid of cards has variety rather
            # than nine copies of one placeholder.
            shade = 'abcdef'[len(cards) % 6]
            squares = ''.join('<span></span>' for _ in range(9))
            cover = (f'          <a class="post__cover post__cover--drawn cover-{shade}" '
                     f'href="{href}" tabindex="-1" aria-hidden="true">\n'
                     f'            <span class="post__nine">{squares}</span>\n'
                     '          </a>')

        tag_markup = (f'          <p class="post__tag">{esc(tag)}</p>\n') if tag else ''
        mins = read_time(post.get('body'))
        cards.append(
            f'        <li class="post" data-category="{esc(cat)}">\n'
            + cover + '\n'
            + tag_markup +
            f'          <p class="post__meta"><time datetime="{esc(post["date"])}">'
            f'{esc(pretty_date(post["date"]))}</time>'
            f' &nbsp;&middot;&nbsp; {mins} min read</p>\n'
            f'          <h3 class="post__title"><a href="{href}">'
            f'{esc(post["title"])}</a></h3>\n'
            f'          <p class="post__summary">{esc(post["summary"])}</p>\n'
            '        </li>'
        )
    return '\n'.join(cards)


def render_blog_filter(data):
    """Buttons that narrow the list to one audience."""
    cats = data.get('categories', [])
    if not cats:
        return ''
    out = ['        <div class="blog-filter" role="group" aria-label="Who the posts are for">',
           '          <button type="button" class="blog-filter__btn" data-filter="all" '
           'aria-pressed="true">Everything</button>']
    for c in cats:
        out.append('          <button type="button" class="blog-filter__btn" '
                   f'data-filter="{esc(c["id"])}" aria-pressed="false">{esc(c["name"])}</button>')
    out.append('        </div>')
    return '\n'.join(out)


def render_blog_count(posts):
    n = len(posts)
    return f'        <p class="posts__count">{n} post{"s" if n != 1 else ""}</p>'


def read_time(body):
    """Roughly how long the post takes to read, at 200 words a minute."""
    words = len(re.findall(r"[\w'-]+", body or ''))
    return max(1, round(words / 200.0))


def render_latest(post, names):
    """One featured article, sitting above the footer."""
    if not post:
        return '      <!-- No posts yet. -->'
    tag = names.get(post.get('category', 'client'), '')
    image = (post.get('image') or '').strip()
    parts = [
        f'      <a class="latest__card" href="blog/{esc(post["slug"])}.html">',
        '        <div class="latest__text">',
        f'          <p class="latest__meta">{read_time(post.get("body"))} min read'
        + (f' &nbsp;&middot;&nbsp; {esc(tag)}' if tag else '') + '</p>',
        f'          <h3 class="latest__title">{esc(post["title"])}</h3>',
        f'          <p class="latest__summary">{esc(post["summary"])}</p>',
        '        </div>',
    ]
    if image:
        parts.append(f'        <img class="latest__image" src="{esc(image)}" alt="" '
                     'width="480" height="270" loading="lazy">')
    parts.append('      </a>')
    return '\n'.join(parts)


def render_tldr(points):
    """The short version, for somebody who will not read the long one."""
    if not points:
        return ''
    items = '\n'.join(f'          <li>{esc(p)}</li>' for p in points)
    return ('      <aside class="tldr" aria-labelledby="tldr-h">\n'
            '        <h2 id="tldr-h" class="tldr__title">The short version</h2>\n'
            '        <ul>\n' + items + '\n        </ul>\n'
            '      </aside>')


def render_toc(body_html, has_faq=True):
    """Built from the headings the post already has, so it cannot go stale."""
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body_html, re.S)
    if len(heads) < 2:
        return ''
    items = '\n'.join(
        f'            <li><a href="#{hid}">{re.sub(r"<[^>]+>", "", text).strip()}</a></li>'
        for hid, text in heads)
    faq_row = ('\n            <li><a href="#post-faq">Frequently asked questions</a></li>'
               if has_faq else '')
    return ('        <nav class="post-toc" aria-labelledby="post-toc-h">\n'
            '          <h2 id="post-toc-h" class="post-toc__title">On this page</h2>\n'
            '          <ol>\n' + items + faq_row + '\n'
            '          </ol>\n'
            '        </nav>')


def render_post_faq(items):
    """The questions this particular post leaves people with."""
    if not items:
        return ''
    rows = []
    for item in items:
        rows.append('          <div>\n'
                    f'            <dt>{esc(item["question"])}</dt>\n'
                    f'            <dd>{esc(item["answer"])}</dd>\n'
                    '          </div>')
    return ('      <section class="post-faq" id="post-faq" aria-labelledby="post-faq-h">\n'
            '        <h2 id="post-faq-h">Frequently asked questions</h2>\n'
            '        <dl class="faq">\n' + '\n'.join(rows) + '\n        </dl>\n'
            '      </section>')


def write_post_pages(data, shell):
    os.makedirs('blog', exist_ok=True)
    written = []
    for post in data['posts']:
        body = markdown(post.get('body', ''))
        page = shell
        page = page.replace('{{TITLE}}', esc(post['title']))
        page = page.replace('{{SUMMARY}}', esc(post['summary']))
        page = page.replace('{{SLUG}}', esc(post['slug']))
        page = page.replace('{{DATE_ISO}}', esc(post['date']))
        page = page.replace('{{DATE_HUMAN}}', esc(pretty_date(post['date'])))
        page = page.replace('{{AUTHOR}}', esc(post.get('author', 'Personal Paparazzi')))
        page = page.replace('{{BODY}}', body)
        page = page.replace('{{TLDR}}', render_tldr(post.get('tldr', [])))
        page = page.replace('{{TOC}}', render_toc(body, bool(post.get('faq'))))
        page = page.replace('{{FAQ}}', render_post_faq(post.get('faq', [])))
        pairs = [(i['question'], i['answer']) for i in post.get('faq', [])]
        page = put_schema(page, faq_schema(
            pairs, f'https://personalpaparazzi.com/blog/{post["slug"]}'))
        path = os.path.join('blog', post['slug'] + '.html')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(page)
        written.append(path)
    return written


def main():
    # questions, on the provider page
    rows, qdata = render_questions()
    page = open('become-a-paparazzi.html', encoding='utf-8').read()
    page = replace_block(page, 'questions', rows)
    page = re.sub(r'(<h2 id="q-h">).*?(</h2>)',
                  lambda m: m.group(1) + esc(qdata['heading']) + m.group(2), page)
    qflat = [(i['question'], i['answer']) for i in qdata['items']]
    page = put_schema(page, faq_schema(qflat, 'https://personalpaparazzi.com/become-a-paparazzi'))
    select, script, pdata = render_places()
    page = replace_block(page, 'places', select)
    page = replace_block(page, 'placesdata', script)
    open('become-a-paparazzi.html', 'w', encoding='utf-8').write(page)
    print(f'  become-a-paparazzi.html  {len(qdata["items"])} questions, '
          f'{len(pdata["places"])} places in {pdata["city"]}')

    # tips, on the tutorials page
    cards, toc, tdata = render_tips()
    page = open('tutorials.html', encoding='utf-8').read()
    page = replace_block(page, 'tips', cards)
    page = replace_block(page, 'tipstoc', toc)

    page = replace_block(page, 'tipsvideo', render_video(tdata))
    open('tutorials.html', 'w', encoding='utf-8').write(page)
    print(f'  tutorials.html           {len(tdata["groups"])} groups, '
          f'{sum(len(g["items"]) for g in tdata["groups"])} tips')

    # blog: the index, the posts, and the teaser on the landing page
    bdata = load('blog.json')
    posts = sorted(bdata['posts'], key=lambda p: p['date'], reverse=True)
    names = {c['id']: c['name'] for c in bdata.get('categories', [])}

    page = open('blog.html', encoding='utf-8').read()
    page = replace_block(page, 'bloglist', render_blog_cards(posts, names=names))
    page = replace_block(page, 'blogfilter', render_blog_filter(bdata))
    page = replace_block(page, 'blogcount', render_blog_count(posts))
    page = re.sub(r'(<h1>).*?(</h1>)',
                  lambda m: m.group(1) + esc(bdata['heading']) + m.group(2), page, count=1)
    page = re.sub(r'(<h1>.*?</h1>\s*<p>).*?(</p>)',
                  lambda m: m.group(1) + esc(bdata['intro']) + m.group(2), page, count=1, flags=re.S)
    open('blog.html', 'w', encoding='utf-8').write(page)

    shell = open(os.path.join('tools', 'post.template.html'), encoding='utf-8').read()
    written = write_post_pages({'posts': posts}, shell)

    client_posts = [p for p in posts if p.get('category', 'client') == 'client']
    supplier_posts = [p for p in posts if p.get('category') == 'supplier']

    page = open('index.html', encoding='utf-8').read()
    newest = (client_posts or posts)[0] if (client_posts or posts) else None
    page = replace_block(page, 'latest', render_latest(newest, names))

    cfaq = load('faq-client.json')
    page = replace_block(page, 'clientfaq', render_featured_faq(cfaq))
    page = re.sub(r'(<h2 id="q-h">).*?(</h2>)',
                  lambda m: m.group(1) + esc(cfaq['heading']) + m.group(2), page, count=1)
    page = re.sub(r'(<h2 id="q-h">.*?</h2>\s*<p>).*?(</p>)',
                  lambda m: m.group(1) + esc(cfaq['intro']) + m.group(2),
                  page, count=1, flags=re.S)
    picked = featured_pairs(cfaq)
    page = put_schema(page, faq_schema(picked, 'https://personalpaparazzi.com/'))
    open('index.html', 'w', encoding='utf-8').write(page)

    # the whole list, on its own page
    flat = [(i['question'], i['answer']) for g in cfaq['groups'] for i in g['items']]
    fpage = open('faq.html', encoding='utf-8').read()
    fpage = replace_block(fpage, 'clientfaq', render_client_faq(cfaq))
    fpage = re.sub(r'(<h1>).*?(</h1>)',
                   lambda m: m.group(1) + esc(cfaq['pageHeading']) + m.group(2),
                   fpage, count=1)
    fpage = re.sub(r'(<p class="page-head__standfirst">).*?(</p>)',
                   lambda m: m.group(1) + esc(cfaq['pageIntro']) + m.group(2),
                   fpage, count=1, flags=re.S)
    fpage = put_schema(fpage, faq_schema(flat, 'https://personalpaparazzi.com/faq'))
    open('faq.html', 'w', encoding='utf-8').write(fpage)
    print(f'  index.html               {len(picked)} of {len(flat)} client questions')
    print(f'  faq.html                 all {len(flat)} in {len(cfaq["groups"])} groups')

    if supplier_posts:
        page = open('become-a-paparazzi.html', encoding='utf-8').read()
        if '<!-- CMS:blogsupplier:start -->' in page:
            page = replace_block(page, 'blogsupplier',
                                 render_blog_cards(supplier_posts, limit=3))
            open('become-a-paparazzi.html', 'w', encoding='utf-8').write(page)
    print(f'  blog.html + {len(written)} post pages + the teaser on index.html')

    # a sitemap, since a blog only pays off if it can be found
    urls = ['', 'become-a-paparazzi.html', 'faq.html', 'tutorials.html', 'blog.html',
            'privacy-policy.html', 'terms.html'] + [f'blog/{p["slug"]}.html' for p in posts]
    base = 'https://personalpaparazzi.com/'
    body = '\n'.join(f'  <url><loc>{base}{u}</loc></url>' for u in urls)
    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + body + '\n</urlset>\n')
    print(f'  sitemap.xml              {len(urls)} pages')


if __name__ == '__main__':
    print('Building pages from content/ ...')
    main()
    print('Done.')
