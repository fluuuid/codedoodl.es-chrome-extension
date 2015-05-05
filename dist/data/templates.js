window._TEMPLATES = {"template":[{"_":"<div id=\"main\"></div>","$":{"id":"main"}},{"_":"<div id=\"wrapper\"></div>","$":{"id":"wrapper"}},{"_":"<header id=\"site-header\">\n                <h1 class=\"logo\" data-logo><a class=\"logo__link\" href=\"http://codedoodl.es\" target=\"_blank\" data-codeword data-codeword-initial-state=\"red\"><%= home_label %></a></h1>\n                <nav class=\"site-nav\">\n                    <a class=\"site-nav__link info-btn\" href=\"#\" data-show-info data-word-section=\"doodle-info\" data-codeword data-codeword-initial-state=\"offwhite\"><%= info_label %></a>\n                </nav>\n                <a href=\"#\" class=\"close-btn\" data-close-doodle data-codeword data-codeword-initial-state=\"\"><%= close_label %></a>\n            </header>","$":{"id":"site-header"}},{"_":"<footer id=\"site-footer\"></footer>","$":{"id":"site-footer"}},{"_":"<section id=\"page-doodle\" class=\"page page-doodle\">\n                <div class=\"page-content\">\n                    <iframe frameborder=\"0\" data-doodle-frame class=\"doodle-frame\"></iframe>\n                    <span class=\"preloader-dots\" data-dots><i class=\"dot dot-1\"></i><i class=\"dot dot-2\"></i><i class=\"dot dot-3\"></i></span>\n                    <div class=\"subpage-info\" data-doodle-info></div>\n                    <span class=\"subpage-info-pane\"></span>\n                </div>\n                <footer class=\"doodle-footer\">\n                    <div class=\"interaction-indicators\">\n                        <span class=\"indicator indicator-mouse\" data-indicator=\"mouse\">\n                            <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 864\"><path d=\"M560 207.3c-69.8 0-126.5 56.6-126.5 126.4v196.6c0 69.8 56.7 126.4 126.5 126.4s126.4-56.6 126.4-126.4V333.7c.1-69.9-56.5-126.4-126.4-126.4zm98.3 323c0 54.3-44 98.4-98.3 98.4s-98.4-44-98.4-98.4V333.7c0-54.3 44-98.4 98.4-98.4 54.2 0 98.3 44 98.3 98.4v196.6zM560 277.5c-7.8 0-14.1 6.3-14.1 14.1v70.2c0 7.7 6.3 14 14.1 14 7.7 0 14-6.2 14-14v-70.2c0-7.8-6.2-14.1-14-14.1zm0 0\"/></svg>\n                        </span>\n                        <span class=\"indicator indicator-keyboard\" data-indicator=\"keyboard\">\n                            <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 864\"><path d=\"M335.2 504.7c-30.9 0-55.9 25-55.9 55.9s25 56.1 55.9 56.1 56.1-25.2 56.1-56.1c0-30.9-25-55.9-56.1-55.9zM559.5 504.7c-30.9 0-56.1 25-56.1 55.9s25.2 56.1 56.1 56.1c30.9 0 55.9-25.2 55.9-56.1.1-30.9-25-55.9-55.9-55.9zM559.5 245.4c-30.9 0-56.1 25.2-56.1 56.1s25.2 56.1 56.1 56.1c30.9 0 55.9-25.2 55.9-56.1s-25-56.1-55.9-56.1zM783.6 504.7c-30.9 0-56.1 25-56.1 55.9s25.2 56.1 56.1 56.1c30.9 0 56.1-25.2 56.1-56.1 0-30.9-25.2-55.9-56.1-55.9z\"/></svg>\n                        </span>\n                        <span class=\"indicator indicator-touch\" data-indicator=\"touch\">\n                            <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1120 864\"><path d=\"M602.7 652.5c-56.9 0-69.8-17-101.9-70.8l-1.5-4.8-76.4-129.2c-5.1-4.8-8.3-12.7-8.3-21.1 0-8.4 3.3-16.2 9.2-22.1 11.8-11.8 32.5-11.8 44.3 0l19.5 19.5V294c0-17.3 14-31.3 31.3-31.3s31.3 14 31.3 31.3v108.9c5.5-4.8 12.6-7.7 20.5-7.7 10.7 0 20.2 5.4 25.9 13.7 5.6-8.3 15.1-13.7 25.9-13.7 12.7 0 23.7 7.6 28.6 18.5 5.7-6.3 14-10.3 23.2-10.3 17.3 0 31.3 14 31.3 31.3v143.9c0 25.1-9 44.1-26.9 56.4-17.2 11.8-42 17.5-76 17.5zm-83.5-79.1c29.7 49.6 37.3 59.1 83.5 59.1 29.4 0 51.1-4.7 64.4-13.8 12.5-8.6 18.3-21.3 18.3-39.9v-144c0-6.2-5-11.2-11.2-11.2-6.2 0-11.2 5-11.2 11.2 0 8.1-6.6 14.6-14.6 14.6-8.1 0-14.6-6.6-14.6-14.6v-8.3c0-6.2-5-11.2-11.2-11.2s-11.3 5-11.3 11.2c0 8.1-6.5 14.6-14.6 14.6s-14.6-6.6-14.6-14.6c0-6.2-5-11.2-11.2-11.2-6.2 0-11.2 5-11.3 11.3 0 8.1-6.6 14.6-14.6 14.6-8.1 0-14.6-6.6-14.6-14.6V294c0-6.2-5-11.2-11.2-11.2-6.2 0-11.3 5-11.3 11.2v143c0 6-3.6 11.3-9.1 13.5-5.2 2.2-11.7.9-15.9-3.2l-28.8-28.8c-4.3-4.3-11.6-4.3-15.9 0-2.1 2.1-3.3 4.9-3.3 7.9s1.2 5.8 3.3 8l2.2 2.9 77.1 130.4c.8 1.9 1.5 3.8 1.7 5.7z\"/><path d=\"M518.8 211.5c-39.4 0-71.5 32.1-71.5 71.5 0 29.5 17.9 54.8 43.4 65.7-.4-1.7-.5-3.3-.5-5v-10.4c0-2.4.4-4.7 1.1-6.9-14.3-9.1-23.9-25.1-23.9-43.3 0-28.4 23.1-51.4 51.4-51.4 28.3 0 51.4 23.1 51.4 51.4 0 19.9-11.5 37-28.1 45.6.3 1.5.5 3.1.5 4.7v10.4c0 2.4-.4 4.6-1 6.7 28.2-9.6 48.6-36 48.6-67.4.1-39.5-32-71.6-71.4-71.6z\"/></svg>\n                        </span>\n                    </div>\n                </footer>\n            </section>","$":{"id":"page-doodle"}},{"_":"<div class=\"subpage-content\">\n                <span class=\"doodle-preview\">\n                    <span class=\"doodle-preview-thumb-holder\">\n                        <span class=\"doodle-preview-thumb-cover\"></span>\n                        <span class=\"doodle-preview-thumb\" style=\"background-image: url(https://placeimg.com/300/300/any?time=<%= Math.random()*9999 %>)\"></span>\n                    </span>\n                    <span class=\"doodle-preview-number\">\n                        <%= indexHTML %>\n                    </span>\n                    <span class=\"doodle-preview-line\"></span>\n                </span>\n                <div class=\"row row-author cf\">\n                    <div class=\"col col-1\">01. <%= label_author %></div>\n                    <div class=\"col col-2\"><%= content_author %></div>\n                </div>\n                <div class=\"row row-doodle-name cf\">\n                    <div class=\"col col-1\">02. <%= label_doodle_name %></div>\n                    <div class=\"col col-2\"><%= content_doodle_name %></div>\n                </div>\n                <div class=\"row row-description cf\">\n                    <div class=\"col col-1\">03. <%= label_description %></div>\n                    <div class=\"col col-2\"><%= content_description %></div>\n                </div>\n                <div class=\"row row-tags cf\">\n                    <div class=\"col col-1\">04. <%= label_tags %></div>\n                    <div class=\"col col-2\"><%= content_tags %></div>\n                </div>\n                <div class=\"row row-interaction cf\">\n                    <div class=\"col col-1\">05. <%= label_interaction %></div>\n                    <div class=\"col col-2\"><%= content_interaction %></div>\n                </div>\n                <div class=\"row row-share cf\">\n                    <div class=\"col col-1\">06. <%= label_share %></div>\n                    <div class=\"col col-2\"><a href=\"#\" data-share-btn=\"twitter\">Twitter</a>, <a href=\"#\" data-share-btn=\"facebook\">Facebook</a>, or copy <a href=\"<%= share_url %>\"><%= share_url_text %></a></div>\n                </div>\n            </div>","$":{"id":"doodle-info"}}]};