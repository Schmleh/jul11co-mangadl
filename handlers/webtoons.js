var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

var lastChar = function(str) {
  if (!str) return '';
  if (str.length == 1) return str;
  return str.substring(str.length-1);
}

var removeLastChar = function(str) {
  return str.substring(0, str.length-1);
}

var removeLastChars = function(str, char_to_remove) {
  while(lastChar(str) == char_to_remove) {
    str = removeLastChar(str);
  }
  return str;
}

module.exports = {
  
  name: 'LINE Webtoons',
  website: 'http://www.webtoons.com',

  match: function(link, options) {
    return /www\.webtoons\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Webtoons');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.viewer_lst').length) {
      if (options.debug) console.log('---');
      if (options.debug) console.log('Chapter page: ' + page.url);

      var chapter_title = $('.subj_info h1.subj_episode').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      // chapter_title = utils.replaceAll(chapter_title, '.', '_');
      chapter_title = removeLastChars(chapter_title, '.');

      if (options.debug) console.log('Chapter title: ' + chapter_title);

      // Get images on current page
      var chapter_images = [];
      $('.viewer_lst .viewer_img img').each(function() {
        var image_src = $(this).attr('data-url');
        if (image_src) {
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      });
      if (options.debug) console.log(chapter_images);

      var chapter_output_dir = '';
      // chapter_output_dir = path.join(options.output_dir, 
      //   path.basename(path.dirname(page.output_dir)) + '-' + path.basename(page.output_dir));
      chapter_output_dir = path.join(options.output_dir, chapter_title);
      
      var download_options = Object.assign(options, {
        request_headers: {
          "Referer": page.url      
        }
      });

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, download_options, callback);

    } else if ($('.detail_header .info').length && $('.detail_lst'.length)) {
      console.log('----');
      console.log('Manga page: ' + page.url);
      
      $('.detail_header .info .toon_btn').remove();
      var manga_title = $('.detail_header .info .subj').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      // manga_title = utils.replaceAll(manga_title, '.', '_');
      manga_title = removeLastChars(manga_title, '.');
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');

      if (options.auto_manga_dir && page.url.indexOf('&page=') == -1) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      if (page.url.indexOf('&page=') == -1) {
        saver.setStateData('url', page.url);
        if (options.save_index_html) {
          saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
        }
        var manga_info = this.getMangaInfo($, page, options);
        if (manga_info && manga_info.url) {
          saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
        }
      }

      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, '.detail_lst ul#_listUl li', {
        filters: [
          'www.webtoons.com'
        ]
      });

      chapter_links = chapter_links.filter(function(link) {
        return !saver.isDone(link.replace('https://', 'http://'));
      });

      var chapter_list_pages = [];
      if ($('.paginate').length && $('.paginate a').length) {
        $('.paginate a').each(function() {
          var pag_link = $(this).attr('href');
          if (pag_link && pag_link != '#' && chapter_list_pages.indexOf(pag_link) == -1) {
            chapter_list_pages.push(pag_link);
          }
        });
      }

      saver.downloadMangaChapters(chapter_links, options, function(err) {
        if (err) return callback(err);
        
        if (chapter_list_pages.length) {
          saver.processPages(chapter_list_pages, options, callback);
        } else {
          callback();
        }
      });
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.detail_header .info').length && $('.detail_lst'.length)) {
      manga_info.url = page.url;
      $('.detail_header .info .toon_btn').remove();
      manga_info.name = $('.detail_header .info .subj').first().text().trim();
      manga_info.cover_image = $('.detail_header .thmb img').first().attr('src');
      manga_info.description = $('.detail_body p.summary').first().text().trim();

      if ($('.detail_header .info .author').length) {
        manga_info.authors = [];
        $('.detail_header .info .author > a').remove();
        $('.detail_header .info .author > span.ico_info2').remove();
        $('.detail_header .info .author').each(function() {
          manga_info.authors.push($(this).text().trim());
        });
      }
      if ($('.detail_header .info .genre').length) {
        manga_info.genres = [];
        $('.detail_header .info .genre').each(function() {
          manga_info.genres.push($(this).text().trim());
        });
      }

      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        // console.log('    Authors: ' + manga_info.authors);
        // console.log('    Genres: ' + manga_info.genres);
        // console.log('    Status: ' + manga_info.status);
        // console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}
