// native
var path = require('path'),
	fs   = require('fs');

// external modules
var htmlparser2 = require('htmlparser2'),
    DomHandler  = require('domhandler'),
    DomUtils    = require('domutils'),
    _           = require('lodash');


// Creates a parser function to be used.
// The returned parser takes an html string and returns the marked-html.
// 
// SEE:
// https://github.com/fb55/htmlparser2/blob/master/lib/index.js#L39-L43 
function createParser(options) {

	// get some values
	var fname = options.fname;

	/**
	 * getNodeXPath Retrieves the node xPath
	 * @param  {[type]} node [description]
	 * @return {[type]}      [description]
	 */
	function getNodeXPath(node) {

		var paths = [];

		for (; node && node.type === 'tag'; node = node.parent) {
			var index = 0;

			for (var sibling = node.prev; sibling; sibling = sibling.prev) {
				if (sibling.type !== 'tag') {
					continue;
				} else if (sibling.name === node.name) {
					++index
				}
			}

			var pathIndex = (index ? "[" + (index+1) + "]" : "");
			paths.splice(0, 0, node.name + pathIndex);
		}

		return paths.length ? "/" + paths.join("/") : null;
	}

	// function that adds attributes to the element
	// xpath and file name
	function elementCB(element) {
		// xpath
		element.attribs[options.xPathAttribute] = getNodeXPath(element);
		// file name
		element.attribs[options.fnameAttribute] = fname;

		// startIndex
		element.attribs[options.startIndexAttribute] = element.startIndex;

		// endIndex
		element.attribs[options.endIndexAttribute] = element.endIndex;


		// if there are styles to be injected,
		// and if the leement is of the type 'head',
		// inject them to the end of the element
		if (options.injectStylesheets && element.type === 'tag' && element.name === 'head') {

			options.injectStylesheets.forEach(function (stylesheetHref) {

				var stylesheetLinkElement = {
					type: 'tag',
					name: 'link',
					attribs: {
						rel: "stylesheet",
						type: "text/css",
						href: stylesheetHref
					}
				};

				// add to the children of the head element
				element.children.push(stylesheetLinkElement);
			});

		}


		// if there are scripts to be injected, 
		// and if the element is of type 'body',
		// inject them to the end of the element
		if (options.injectScripts && element.type === 'tag' && element.name === 'body') {

			options.injectScripts.forEach(function (scriptSrc) {

				var scriptElement = {
					type: 'tag',
					name: 'script',
					attribs: {
						src: scriptSrc
					}
				};

				// add to the children of the body element
				element.children.push(scriptElement);
			});
		}
	}



	// return function that does parsing
	// 
	// SEE:
	// https://github.com/fb55/htmlparser2/blob/master/lib/index.js#L39-L43
	return function (html) {

		// create new handler
		var handler = new DomHandler({
			withStartIndices: true,
			withEndIndices: true
		}, elementCB);

		// create parser usign the newly created handler
		var parser = new htmlparser2.Parser(handler);

		// insert the data into the parser
		parser.end(html);

		// return the dom, which is a property of the handler
		return DomUtils.getOuterHTML(handler.dom);
	};
}


// Export
module.exports = function serveMarkedHtml(options, res) {

	// set default options
	_.defaults(options, {
		root: __dirname,
		xPathAttribute: 'data-x-path',
		fnameAttribute: 'data-fname',
		startIndexAttribute: 'data-start-index',
		endIndexAttribute: 'data-end-index',
	});

	// get some options
	var root  = options.root,				// root path for the html files
		fname = options.fname;				// file name, from the root path

	// build up the full path
	var fFullPath = path.join(root, fname);


	// create parser
	var parser = createParser(options);

	// read the file contents
	fs.readFile(fFullPath, { encoding: 'utf8' }, function onread(err, html) {
		// build markedHtml
		var markedHtml = parser(html);

		// overwrite the Content-Length header
		res.setHeader('Content-Length', markedHtml.length);

		// respond
		res.end(markedHtml);
	});

};