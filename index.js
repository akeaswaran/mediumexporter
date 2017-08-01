#! /usr/bin/env node

var program = require('commander')
  , utils = require('./utils')
  , package = require('./package.json')
  , Promise = require('bluebird')
  ,	fs = require('fs'),
  	dateformat = require('dateformat')
  ;

program
  .version(package.version)
  .description(package.description)
  .usage('[options] <medium post url>')
  .option('-H, --headers', 'Add headers at the beginning of the markdown file with metadata')
  .option('-S, --separator <separator>', 'Separator between headers and body','')
  .option('-O, --output <output folder location>', 'Where to put the new file','')
  .option('-B, --addMetadata', 'Add personal blog metadata to the top of the file','')
  .option('-I, --info', 'Show information about the medium post')
  .option('-d, --debug', 'Show debugging info')
  .on('--help', function(){
    console.log('  Examples:');
    console.log('');
    console.log('    $ mediumexporter https://medium.com/@xdamman/my-10-day-meditation-retreat-in-silence-71abda54940e --output medium_posts');
    console.log('    $ mediumexporter --headers --separator --- --output medium_post.md https://medium.com/@xdamman/my-10-day-meditation-retreat-in-silence-71abda54940e --output medium_posts');
    console.log('    $ mediumexporter mediumpost.json');
    console.log('');
  });

program.parse(process.argv);

var mediumURL = program.args[0];

utils.loadMediumPost(mediumURL, function(err, json) {

  var s = json.payload.value;
  var story = {};

  story.title = s.title;
  story.date = new Date(s.createdAt);
  story.url = s.canonicalUrl;
  story.language = s.detectedLanguage;
  story.license = s.license;

  if(program.info) {
    console.log(story);
    process.exit(0);
  }

  if(program.headers) {
    console.log("url: "+story.url);
    console.log("date: "+story.date);
    console.log(program.separator);
  }

  story.sections = s.content.bodyModel.sections;
  story.paragraphs = s.content.bodyModel.paragraphs;

  var sections = [];
  for(var i=0;i<story.sections.length;i++) {
    var s = story.sections[i];
    var section = utils.processSection(s);
    sections[s.startIndex] = section;
  }

  if(story.paragraphs.length > 1) {
    story.subtitle = story.paragraphs[1].text;
  }

  story.markdown = [];
  story.markdown.push("\n# "+story.title.replace(/\n/g,'\n# '));
  if (undefined != story.subtitle) {
    story.markdown.push("\n"+story.subtitle.replace(/#+/,''));
  }

  var promises = [];

  for(var i=2;i<story.paragraphs.length;i++) {

    if(sections[i]) story.markdown.push(sections[i]);

    var promise = new Promise(function (resolve, reject) {
      var p = story.paragraphs[i];
      utils.processParagraph(p, function(err, text) {
        // Avoid double title/subtitle
        if(text != story.markdown[i])
          return resolve(text);
        else
          return resolve();
      });
    });
    promises.push(promise);
  }

  Promise.all(promises).then((results) => {
    results.map(text => {
      story.markdown.push(text);
    })

    if (program.debug) {
      console.log("debug", story.paragraphs);
    }

	var postContent = '';
	var generatedFileName = utils.strReplaceAll(story.title.toLocaleLowerCase(), " ", "-");
	if (program.addMetadata) {
		postContent += '---\n'
		postContent += 'layout: post\n';
		postContent += 'title: ' + story.title + '\n';
		postContent += 'description: ' + story.subtitle + '\n';
		postContent += 'permalink: /' + generatedFileName + '/\n';
		postContent += '---\n\n';
	}

	postContent += story.markdown.join('\n');

	var fileName = program.output + '/' + dateformat(story.date, 'yyyy-mm-dd') + '-' + generatedFileName + '.md';
	console.log('Writing post to file: ' + fileName + '...\n');
	fs.writeFile(fileName, postContent, (err) => {
	  if (err) throw err;
	  console.log('Export done! See ' + program.output + ' for your post!\n\n');
	});
  });
});
