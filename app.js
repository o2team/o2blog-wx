'use strict';

// 依赖
var path        = require('path');
var express     = require('express');
var app         = express();
var superagent  = require('superagent');
var cheerio     = require('cheerio');
var async       = require('async');

// 定义需要爬取的链接地址
var URL         = 'http://aotu.io';

// 服务器监听端口号
var port = '5555';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.get('/', function( req, res, next ){
    var _query = req.query,
         _page = _query.page,
        _count = _query.count,
        source = _query.source; // true:返回文章源码

    async.auto({
        // step1: 获取文章链接
        get_links: function( callback ){            
            superagent.get( URL )
                .end(function( err, resp ){
                    if( err ) callback(err);
                    var $ = cheerio.load( resp.text );
                    var items = [];
                    $('article.mini-post a.image').each(function( idx, ele ){
                        var $ele = $(ele);
                        items.push({
                            title: $ele.find('img').attr('alt'),
                            href: 'http://aotu.io' + $ele.attr('href'),
                            author: $ele.parent().find('.author img').attr('alt')
                        });
                    });
                    callback(null, items);
                });        
        },

        // step2: 获取文章内容
        get_content: ['get_links', function( callback, results ){
            var items = results.get_links,
                count = items.length;

            _count = _count || count;

            items.forEach(function( item, idx ){
                var href = item.href;
                superagent.get( href )
                    .end(function( err, resp ){
                        // 如果出错直接抛出错误
                        if( err ) callback(err);

                        var $ = cheerio.load( resp.text );
                        
                        // 格式处理
                        $('a').each(function( idx, ele ){
                            $(ele).attr('href', replaceLink( $(ele).attr('href') ));
                        });
                        $('img').each(function( idx, ele ){
                            $(ele).attr('src', replaceLink( $(ele).attr('src') ));
                        });
                        $('h1,h2,h3,h4,h5,h6').each(function( idx, ele ){
                            var tpl = '<section class="aotu_header tn-comp-pin tn-comp-style-pin tn-comp-anim-pin ng-scope"><div style="border-top-width: 2px; border-top-style: solid; border-color: rgb(95, 156, 239); padding-top: 3px;" class="ng-scope"><div style="display: inline-block; vertical-align: top; height: 2em; line-height: 2em; padding: 0px 0.5em; color: rgb(255, 255, 255); background-color: rgb(95, 156, 239);" class="ng-binding ng-scope tn-cell tn-cell-text tn-child-position-absolute"><section>'+ $(ele).text() +'</section></div><div style="width: 0px; display: inline-block; vertical-align: top; border-left-width: 0.8em; border-left-style: solid; border-left-color: rgb(95, 156, 239); border-top-width: 1em; border-top-style: solid; border-top-color: rgb(95, 156, 239); border-right-width: 0.8em !important; border-right-style: solid !important; border-right-color: transparent !important; border-bottom-width: 1em !important; border-bottom-style: solid !important; border-bottom-color: transparent !important;"></div></div></section>';
                            $(ele).before(tpl);
                            $(ele).remove();
                        });

                        // 关注提示
                        var focusTipTpl = '<section class="tn-comp-slot ng-scope tn-cell tn-cell-group tn-child-position-absolute"><section class="tn-comp-top-level ng-scope tn-comp tn-from-house-paper-cp" style="position: static;"><section class="tn-comp-pin tn-comp-style-pin tn-comp-anim-pin ng-scope" style="margin-top: 0.5em; margin-left: 30%; line-height: 1em;"><div style="width: 0px; display: inline-block; vertical-align: bottom; border-bottom-width: 13px; border-bottom-style: solid; border-bottom-color: rgb(95, 156, 239); border-left-width: 13px !important; border-left-style: solid !important; border-left-color: transparent !important; border-right-width: 13px !important; border-right-style: solid !important; border-right-color: transparent !important;" class="ng-scope"></div></section></section><section class="tn-comp-top-level ng-scope tn-comp tn-from-house-paper-cp" style="position: static;"><section class="tn-comp-pin tn-comp-style-pin tn-comp-anim-pin ng-scope"><div style="margin: 0px; height: 2.4em; border-radius: 1em; background-color: rgb(95, 156, 239);" class="ng-scope"><img style="height: 1.6em; vertical-align: top; margin: 0.3em 0.5em;" class="ng-scope tn-cell tn-cell-image tn-child-position-absolute" src="/images/tips.png"><div style="display: inline-block; width: 72%; margin-top: 0.6em; line-height: 1;text-align: center; white-space: nowrap; overflow: hidden;"><div style="display: inline-block; white-space: nowrap; overflow: hidden; color: white; font-size: 87.5%; line-height: 1.3;" class="ng-binding ng-scope tn-cell tn-cell-text tn-child-position-absolute"><section>波多点击了上面的凹凸实验室！</section></div></div></div></section></section><section class="tn-comp-top-level ng-scope tn-comp tn-from-house-paper-cp" style=""><section class="tn-comp-pin tn-comp-style-pin tn-comp-anim-pin ng-scope"><div style="text-align:left" tn-cell-type="text" class="ng-scope ng-binding tn-cell tn-cell-text tn-child-position-absolute"><p><br></p></div></section></section></section>';
                        $('.post-content').prepend( focusTipTpl )

                        item.content = $('.post-content').html().replace(/(div)/gi,'section').replace(/(\<p\>)/gi,'<section class="para">').replace(/(\<\/p\>)/gi,'</section>').replace(/(figure)/gi,'section');

                        // 循环结束之后callback
                        if( !--count ){
                            callback(null, items);        
                        }
                    });

            });            
        }]
    }, function( err, results ){
        if( !err ){
            if( source == 'true' ){
                var result = _page ? results.get_content[_page] : results.get_content;
                res.status(200).send( result );
            } else {
                res.render('result', {
                    result: results.get_content,
                    page: _page, 
                    count: _count
                });
            }
        }
    });
});

// 判断给的地址是否有前缀，无则加上前缀
function replaceLink( original ){
    original = original || '';
    return original.indexOf('http') > -1 ? original : URL + original;
}

// 启动APP
app.listen(port, function(){
    console.log('App is listening at port ' + port);
});