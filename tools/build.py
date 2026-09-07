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
            out.append('<h2>' + inline(line[3:].strip()) + '</h2>')
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


# --------------------------------------------------------------------- blog --

def render_blog_cards(posts, limit=None):
    cards = []
    for post in posts[:limit] if limit else posts:
        cards.append(
            '        <li class="post">\n'
            f'          <p class="post__date"><time datetime="{esc(post["date"])}">'
            f'{esc(pretty_date(post["date"]))}</time></p>\n'
            f'          <h3 class="post__title"><a href="blog/{esc(post["slug"])}.html">'
            f'{esc(post["title"])}</a></h3>\n'
            f'          <p class="post__summary">{esc(post["summary"])}</p>\n'
            '        </li>'
        )
    return '\n'.join(cards)


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
    open('become-a-paparazzi.html', 'w', encoding='utf-8').write(page)
    print(f'  become-a-paparazzi.html  {len(qdata["items"])} questions')

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

    page = open('blog.html', encoding='utf-8').read()
    page = replace_block(page, 'bloglist', render_blog_cards(posts))
    open('blog.html', 'w', encoding='utf-8').write(page)

    shell = open(os.path.join('tools', 'post.template.html'), encoding='utf-8').read()
    written = write_post_pages({'posts': posts}, shell)

    teaser = render_blog_cards(posts, limit=3).replace('href="blog/', 'href="blog/')
    page = open('index.html', encoding='utf-8').read()
    page = replace_block(page, 'blogteaser', teaser)
    open('index.html', 'w', encoding='utf-8').write(page)
    print(f'  blog.html + {len(written)} post pages + the teaser on index.html')

    # a sitemap, since a blog only pays off if it can be found
    urls = ['', 'become-a-paparazzi.html', 'tutorials.html', 'blog.html',
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
