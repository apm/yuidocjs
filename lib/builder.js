/*
Copyright (c) 2011, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://yuilibrary.com/license/
*/

var markdown = require("node-markdown").Markdown,
    fs = require('fs'),
    handlebars = require('./handlebars').Handlebars,
    noop = function() {},
    path = require('path'),
    TEMPLATE;


/**
* Takes the `JSON` data from the `DocParser` class, creates and parses markdown and handlebars
based templates to generate static HTML content
* @class DocBuilder
* @module yuidoc
*/

YUI.add('doc-builder', function(Y) {

    var print = function(items) {
        var out = '<ul>';

        Y.each(items, function(i, k) {
            out += '<li>';
            if (Y.Lang.isObject(i)) {
                if (!i.path) {
                    out += k + '/' + print(i);
                } else {
                    out += '<a href="../files/' + i.name + '.html">' + k + '</a>';
                }
            }
            out += '</li>';
        });

        out += '</ul>';
        return out;
    };

    handlebars.registerHelper('buildFileTree', function(items, fn) {
        return print(items);
    });

    var themeDir = path.join(__dirname, '../', 'themes', 'default');

    Y.DocBuilder = function(options, data) {
        this.options = options;
        if (options.themedir) {
            themeDir = options.themedir;
        }
        this.data = data;
        Y.log('Building..', 'info', 'builder');
        this.files = 0;
        var self = this;

        handlebars.registerHelper('crossLink', function(item, fn) {
            var str = '';
            if (!item) {
                item = '';
            }
            if (item.indexOf('|') > 0) {
                var parts = item.split('|'),
                p = [];
                Y.each(parts, function(i) {
                    p.push(self._parseCrossLink.call(self, i));
                });
                str = p.join(' | ');
            } else {
                str = self._parseCrossLink.call(self, item);
            }
            return str;
        });

    };

    Y.DocBuilder.prototype = {
        _parseCrossLink: function(item) {
            var self = this;
            var base = '../',
                baseName = item,
                newWin = false,
                className = 'crosslink';


            item = baseItem = Y.Lang.trim(item.replace('{', '').replace('}', ''));
            //Remove Cruft
            item = item.replace('*', '').replace('[', '').replace(']', '');
            var link = false;
            if (self.data.classes[item]) {
                link = true;
            } else {
                if (self.data.classes[item.replace('.', '')]) {
                    link = true;
                    item = item.replace('.', '');
                }
            }
            if (!link && self.options.externalData) {
                var d = self.options.externalData;
                if (d && d.classes && d.classes[item]) {
                    base = d.base;
                    className += ' external';
                    newWin = true;
                    link = true;
                }
            }
            if (item === 'Object' || item === 'Array') {
                link = false;
            }
            var href = path.join(base, 'classes', item + '.html');
            if (base.match(/^https?:\/\//)) {
                href = base + path.join('classes', item + '.html');
            }
            if (!link && self.options.linkNatives) {
                if (self.NATIVES && self.NATIVES[item]) {
                    href = self.NATIVES_LINKER(item);
                    if (href) {
                        className += ' external';
                        newWin = true;
                        link = true;
                    }
                }
            }
            if (link) {
                item = '<a href="' + href + '" class="' + className + '"' + ((newWin) ? ' target="_blank"' : '') + '>' + baseItem + '</a>';
            }
            return item;
        },
        NATIVES: {
            'Array': 1,
            'Boolean': 1,
            'Date': 1,
            'decodeURI': 1,
            'decodeURIComponent': 1,
            'encodeURI': 1,
            'encodeURIComponent': 1,
            'eval': 1,
            'Error': 1,
            'EvalError': 1,
            'Function': 1,
            'Infinity': 1,
            'isFinite': 1,
            'isNaN': 1,
            'Math': 1,
            'NaN': 1,
            'Number': 1,
            'Object': 1,
            'parseFloat': 1,
            'parseInt': 1,
            'RangeError': 1,
            'ReferenceError': 1,
            'RegExp': 1,
            'String': 1,
            'SyntaxError': 1,
            'TypeError': 1,
            'undefined': 1,
            'URIError': 1
        },
        NATIVES_LINKER: function(name) {
            return 'https:/'+'/developer.mozilla.org/en/JavaScript/Reference/Global_Objects/' + name;
        },
        _mixExternal: function(err, data) {
            var self = this;
            Y.log('External data received, mixing', 'warn', 'builder');
            self.options.externalData = data;
            /* TODO
            var mixData = [];
            Y.each(self.data.classes, function(i) {
                if (i.extends) {
                    console.error(i.name, 'extends', i.extends);
                    if (!self.data.classes[i.extends]) {
                        console.error('Extended Class not found in local data, checking external');
                        if (data.classes[i.extends]) {
                            console.error('Found extended class in external data');
                            self.data.classes[i.extends] = data.classes[i.extends];
                            Y.each(data.classitems, function(o, k) {
                                if (o.class === i.extends) {
                                    self.data.classitems.push(data.classitems[k]);
                                }
                            });
                            Y.each(data.files, function(o, k) {
                                if (i.extends in o.classes) {
                                    o.path = path.join(data.base, o.name);
                                    self.data.files[k] = o;
                                }
                            });
                        }
                    }
                }
            });
            */
        },
        mixExternal: function(cb) {
            var self = this,
                info = self.options.external;

            if (info) {
                Y.log('External data support is not implemented yet.', 'warn', 'builder');
            } else {
                cb();
                return;
            }
            if (!info.merge) {
                info.merge = 'mix';
            }
            if (!info.data) {
                Y.log('External config found but no data path defined, skipping import.', 'warn', 'builder');
                return;
            }
            if (info.data.match(/^https?:\/\//)) {
                info.base = info.data.replace('data.json', '');
                Y.use('io', function() {
                    Y.io(info.data, {
                        on: {
                            complete: function(id, e) {
                                var data = JSON.parse(e.responseText);
                                data.base = info.base;
                                self._mixExternal(null, data);
                                cb();
                            }
                        }
                    });
                });
            } else {
                info.base = path.dirname(path.resolve(info.data));
                Y.log('Local data mixing is not implemented yet', 'error', 'builder');
                var data = Y.Files.getJSON(info.data);
                data.base = info.base;
                self._mixExternal(null, data);
                cb();
            }
        },
        /**
        * The default tags to use in params descriptions (for Markdown).
        * @property defaultTags
        * @type String
        */
        defaultTags: 'code|em|strong|span|a|pre|dl|dd|dt|ul|li|ol',
        /**
        * File counter
        * @property files
        * @type Number
        */
        files: null,
        /**
        * Prep the meta data to be fed to Selleck
        * @method getProjectMeta
        * @return {Object} The project metadata
        */
        _meta: null,
        getProjectMeta: function() {
            var obj = {
                meta: {
                    yuiSeedUrl: 'http://yui.yahooapis.com/3.4.1/build/yui/yui-min.js',
                    yuiGridsUrl: 'http://yui.yahooapis.com/3.4.1/build/cssgrids/cssgrids-min.css'
                }
            };
            if (!this._meta) {
                try {
                    var meta = Y.Files.getJSON(path.join(themeDir, 'theme.json'));
                    if (meta) {
                        obj.meta = meta;
                        this._meta = meta;
                    }
                } catch (e) {}
            } else {
                obj.meta = this._meta;
            }
            Y.each(this.data.project, function(v, k) {
                var key = k.substring(0, 1).toUpperCase() + k.substring(1, k.length);
                obj.meta['project' + key] = v;
            });
            return obj
        },
        /**
        * Populate the meta data for classes
        * @method populateClasses
        * @param {Object} opts The original options
        * @return {Object} The modified options
        */
        populateClasses: function(opts) {
            opts.meta.classes = [];
            Y.each(this.data.classes, function(v) {
                opts.meta.classes.push({ displayName: v.name, name: v.name});
            });
            opts.meta.classes.sort(this.nameSort);
            return opts;
        },
        /**
        * Populate the meta data for modules
        * @method populateModules
        * @param {Object} opts The original options
        * @return {Object} The modified options
        */
        populateModules: function(opts) {
            var self = this, moddef;
            opts.meta.modules = [];
            opts.meta.allModules = [];
            Y.each(self.data.modules, function(v) {
                opts.meta.allModules.push({ displayName: v.name, name: v.name, description: v.description });
                if (!v.is_submodule) {
                    var o = { displayName: v.name, name: v.name };
                    if (v.submodules) {
                        o.submodules = [];
                        Y.each(v.submodules, function(i, k) {
                            moddef = self.data.modules[k];
                            if (moddef) {
                                o.submodules.push({
                                    displayName: k,
                                    description: moddef.description
                                });
                            } else {
Y.log('Submodule data missing: ' + k + ' for ' + v.name, 'warn', 'builder');
                            }
                        });
                        o.submodules.sort(self.nameSort);
                    }
                    opts.meta.modules.push(o);
                }
            });
            opts.meta.modules.sort(self.nameSort);
            opts.meta.allModules.sort(self.nameSort);
            return opts;
        },
        /**
        * Populate the meta data for files
        * @method populateFiles
        * @param {Object} opts The original options
        * @return {Object} The modified options
        */
        populateFiles: function(opts) {
            var self = this;
            opts.meta.files = [];
            Y.each(this.data.files, function(v) {
                opts.meta.files.push({ displayName: v.name, name: self.filterFileName(v.name), path: v.path || v.name });
            });

            var tree = {};
            var files = [];
            Y.each(this.data.files, function(v) {
                files.push(v.name);
            });
            files.sort();
            Y.each(files, function(v) {
                var p = v.split('/'),
                    par;
                p.forEach(function(i, k) {
                    if (!par) {
                        if (!tree[i]) {
                            tree[i] = {};
                        }
                        par = tree[i];
                    } else {
                        if (!par[i]) {
                            par[i] = {};
                        }
                        if (k + 1 === p.length) {
                            par[i] = {
                                path: v,
                                name: self.filterFileName(v)
                            };
                        }
                        par = par[i];
                    }
                });
            });

            opts.meta.fileTree = tree;

            return opts;
        },
        addFoundAt: function(a) {
            var self = this;
            if (a.file && a.line) {
                a.foundAt = 'files/' + self.filterFileName(a.file) + '.html#l' + a.line;
            }
            return a;
        },
        /**
        * Augments the **DocParser** meta data to provide default values for certain keys as well as parses all descriptions
        * with the `Markdown Parser`
        * @method augmentData
        * @param {Object} o The object to recurse and augment
        * @return {Object} The augmented object
        */
        augmentData: function(o) {
            var self = this;
            o = self.addFoundAt(o);
            Y.each(o, function(i, k1) {
                if (i && i.forEach) {
                    Y.each(i, function(a, k) {
                        if (!(a instanceof Object)) {
                            return;
                        }
                        if (!a.type) {
                            a.type = 'Object'; //Default type is Object
                        }
                        if (a.final === '') {
                            a.final = true;
                        }
                        if (!a.description) {
                            a.description = ' ';
                        } else {
                            a.description = markdown(a.description, true, self.defaultTags);
                        }
                        if (a.example) {
                            a.example = markdown(a.example, true, self.defaultTags);
                        }
                        a = self.addFoundAt(a);

                        Y.each(a, function(c, d) {
                            if (c.forEach || (c instanceof Object)) {
                                c = self.augmentData(c);
                                a[d] = c;
                            }
                        });

                        o[k1][k] = a;
                    });
                } else if (i instanceof Object) {
                    i = self.addFoundAt(i);
                    Y.each(i, function(v, k) {
                        if (k === 'final') {
                            o[k1][k] = true;
                        }
                        if (k === 'description' || k === 'example') {
                            o[k1][k] = markdown(v, true, self.defaultTags);
                        }
                    });
                } else if (k1 === 'description' || k1 === 'example') {
                    o[k1] = markdown(i, true, self.defaultTags);
                }
            });
            return o;
        },
        /**
        * Makes the default directories needed
        * @method makeDirs
        * @param {Callback} cb The callback to execute after it's completed
        */
        makeDirs: function(cb) {
            var self = this;
            var dirs = ['classes', 'modules', 'files'];
            if (self.options.dumpview) {
                dirs.push('json');
            }
            var stack = new Y.Parallel();
            Y.log('Making default directories: ' + dirs.join(','), 'info', 'builder');
            dirs.forEach(function(d) {
                var dir = path.join(self.options.outdir, d);
                path.exists(dir, stack.add(function(x) {
                    if (!x) {
                        fs.mkdir(dir, 0777, stack.add(noop));
                    }
                }));
            });
            stack.done(function() {
                if (cb) {
                    cb();
                }
            });
        },
        /**
        * Parses `<pre><code>` tags and adds the __prettyprint__ `className` to them
        * @method _parseCode
        * @private
        * @param {HTML} html The HTML to parse
        * @return {HTML} The parsed HTML
        */
        _parseCode: function (html) {
            html = html.replace(/<pre><code>/g, '<pre class="code"><code class="prettyprint">');
            return html;
        },
        /**
        * Ported from [Selleck](https://github.com/rgrove/selleck), this handles ```'s in fields
        that are not parsed by the **Markdown** parser.
        * @method _inlineCode
        * @private
        * @param {HTML} html The HTML to parse
        * @return {HTML} The parsed HTML
        */
        _inlineCode: function(html) {
            html = html.replace(/\\`/g, '__{{SELLECK_BACKTICK}}__');

            html = html.replace(/`(.+?)`/g, function (match, code) {
                return '<code>' + Y.escapeHTML(code) + '</code>';
            });

            html = html.replace(/__\{\{SELLECK_BACKTICK\}\}__/g, '`');

            return html;
        },
        /**
        * Ported from [Selleck](https://github.com/rgrove/selleck)
        Renders the handlebars templates with the default View class.
        * @method render
        * @param {HTML} source The default template to parse
        * @param {Class} view The default view handler
        * @param {HTML} [layout=null] The HTML from the layout to use.
        * @param {Object} [partials=object] List of partials to include in this template
        * @param {Callback} callback
        * @param {Error} callback.err
        * @param {HTML} callback.html The assembled template markup
        */
        render: function(source, view, layout, partials, callback) {
            var html = [];

            function buffer(line) {
                html.push(line);
            }

            // Allow callback as third or fourth param.
            if (typeof partials === 'function') {
                callback = partials;
                partials = {};
            } else if (typeof layout === 'function') {
                callback = layout;
                layout = null;
            }
            var parts = Y.merge(partials || {}, { layout_content: source });
            Y.each(parts, function(source, name) {
                handlebars.registerPartial(name, source);
            });

            if (!TEMPLATE) {
                TEMPLATE = handlebars.compile(layout);
            }


            var _v = {};
            for (var k in view) {
                if (Y.Lang.isFunction(view[k])) {
                    _v[k] = view[k]();
                } else {
                    _v[k] = view[k];
                }
            };
            html = TEMPLATE(_v);

            html = this._inlineCode(html);
            callback(null, html);
        },
        /**
        * Generates the index.html file
        * @method writeIndex
        * @param {Callback} cb The callback to execute after it's completed
        */
        writeIndex: function(cb) {
            var self = this;
            var stack = new Y.Parallel();
            Y.prepare(themeDir, self.getProjectMeta(), function(err, opts) {
                Y.log('Preparing index.html', 'info', 'builder');

                //opts.meta.htmlTitle = self.data.project.name;
                opts.meta.title = self.data.project.name;
                opts.meta.projectRoot = './';
                opts.meta.projectAssets = './assets';

                opts = self.populateClasses(opts);
                opts = self.populateModules(opts);

                var view   = new Y.DocView(opts.meta);
                self.render('{{>index}}', view, opts.layouts.main, opts.partials, function(err, html) {
                    self.files++;
                    if (self.options.dumpview) {
                        Y.Files.writeFile(path.join(self.options.outdir, 'json', 'index.json'), JSON.stringify(view), stack.add(noop));
                    }
                    Y.Files.writeFile(path.join(self.options.outdir, 'index.html'), html, stack.add(noop));

                    opts.meta.projectRoot = '../';
                    opts.meta.projectAssets = '../assets';
                });
                stack.done(function() {
                    Y.log('Writing index.html', 'info', 'builder');
                    cb();
                });
            });
        },
        /**
        * Generates the module files under "out"/modules/
        * @method writeModules
        * @param {Callback} cb The callback to execute after it's completed
        */
        writeModules: function(cb) {
            var self = this;
            var stack = new Y.Parallel();
            Y.log('Writing (' + Object.keys(self.data.modules).length + ') module pages', 'info', 'builder');
            Y.each(this.data.modules, function(v) {
                Y.prepare(themeDir, self.getProjectMeta(), function(err, opts) {
                    opts.meta = Y.merge(opts.meta, v);

                    //opts.meta.htmlTitle = v.name + ': ' + self.data.project.name;
                    opts.meta.title = self.data.project.name;

                    opts.meta.moduleName = v.name;
                    opts.meta.moduleDescription = self._parseCode(markdown(v.description || ' '));
                    opts.meta.file = v.file;
                    opts.meta.line = v.line;
                    opts.meta = self.addFoundAt(opts.meta);
                    opts.meta.projectRoot = '../';
                    opts.meta.projectAssets = '../assets';

                    opts = self.populateClasses(opts);
                    opts = self.populateModules(opts);
                    opts = self.populateFiles(opts);

                    if (v.classes && Object.keys(v.classes).length) {
                        opts.meta.moduleClasses = [];
                        Y.each(Object.keys(v.classes), function(name) {
                            var i = self.data.classes[name];
                            if (i) {
                                opts.meta.moduleClasses.push({ name: i.name, displayName: i.name });
                            }
                        });
                        opts.meta.moduleClasses.sort(self.nameSort);
                    }
                    if (v.submodules && Object.keys(v.submodules).length) {
                        opts.meta.subModules = [];
                        Y.each(Object.keys(v.submodules), function(name) {
                            var i = self.data.modules[name];
                            if (i) opts.meta.subModules.push({ name: i.name, displayName: i.name, description: i.description });
                        });
                        opts.meta.subModules.sort(self.nameSort);
                    }

                    var view   = new Y.DocView(opts.meta);
                    self.render('{{>module}}', view, opts.layouts.main, opts.partials, stack.add(function(err, html) {
                        self.files++;
                        if (self.options.dumpview) {
                            Y.Files.writeFile(path.join(self.options.outdir, 'json', 'module_' + v.name + '.json'), JSON.stringify(view), stack.add(noop));
                        }
                        Y.Files.writeFile(path.join(self.options.outdir, 'modules', v.name + '.html'), html, stack.add(noop));
                    }));
                });
            });

            stack.done(function() {
                Y.log('Finished writing module files', 'info', 'builder');
                cb();
            });
        },
        hasProperty: function(a, b) {
            var other;
            var h = Y.some(a, function(i, k) {
                if ((i.itemtype === b.itemtype) && (i.name === b.name)) {
                    other = k;
                    return true;
                }
            });
            return other;
        },
        mergeExtends: function(info, classItems) {
            var self = this;
            if (info.extends || info.uses) {
                var hasItems = {};
                hasItems[info.extends] = 1;
                if (info.uses) {
                    info.uses.forEach(function(v) {
                        hasItems[v] = 1;
                    });
                }
                self.data.classitems.forEach(function(v) {
                    //console.error(v.class, '==', info.extends);
                    if (hasItems[v.class]) {
                        if (!v.static) {
                            var override = self.hasProperty(classItems, v);
                            if (!override) {
                                //This method was extended from the parent class but not over written
                                //console.error('Merging extends from', v.class, 'onto', info.name);
                                var q = Y.merge({}, v);
                                q.extended_from = v.class;
                                classItems.push(q);
                            } else {
                                //This method was extended from the parent and overwritten in this class
                                var q = Y.merge({}, v);
                                q = self.augmentData(q);
                                classItems[override].overwritten_from = q;
                            }
                        }
                    }
                });
                if (self.data.classes[info.extends]) {
                    if (self.data.classes[info.extends].extends || self.data.classes[info.extends].uses) {
                        //console.error('Stepping down to:', self.data.classes[info.extends]);
                        classItems = self.mergeExtends(self.data.classes[info.extends], classItems);
                    }
                }
            }
            return classItems;
        },
        /**
        * Generates the class files under "out"/classes/
        * @method writeClasses
        * @param {Callback} cb The callback to execute after it's completed
        */
        writeClasses: function(cb) {
            var self = this;
            var stack = new Y.Parallel();

            Y.log('Writing (' + Object.keys(self.data.classes).length + ') class pages', 'info', 'builder');
            Y.each(self.data.classes, function(v) {
                Y.prepare(themeDir, self.getProjectMeta(), function(err, opts) {
                    //console.log(opts);
                    if (err) {
                        console.log(err);
                    }
                    opts.meta = Y.merge(opts.meta, v);

                    opts.meta.title = self.data.project.name;
                    opts.meta.moduleName = v.name;
                    opts.meta.file = v.file;
                    opts.meta.line = v.line;
                    opts.meta = self.addFoundAt(opts.meta);
                    opts.meta.projectRoot = '../';
                    opts.meta.projectAssets = '../assets';

                    opts = self.populateClasses(opts);
                    opts = self.populateModules(opts);
                    opts = self.populateFiles(opts);

                    opts.meta.classDescription = self._parseCode(markdown(v.description || ' '));

                    opts.meta.methods = [];
                    opts.meta.properties = [];
                    opts.meta.attrs = [];
                    opts.meta.events = [];
                    if (v.uses) {
                        opts.meta.uses = v.uses;
                    }
                    if (v.entension_for && v.extension_for.length) {
                        opts.meta.extension_for = v.extension_for;
                    }
                    if (v.extends) {
                        opts.meta.extends = v.extends;
                    }

                    var classItems = [];
                    self.data.classitems.forEach(function(i) {
                        if (i.class === v.name) {
                            classItems.push(i);
                        }
                    });

                    classItems = self.mergeExtends(v, classItems);

                    if (v.is_constructor) {
                        var i = Y.mix({}, v);
                        i = self.augmentData(i);
                        i.paramsList = [];
                        if (i.params) {
                            i.params.forEach(function(p, v) {
                                var name = p.name;
                                if (p.optional) {
                                    name = '[' + name + ((p.optdefault) ? '=' + p.optdefault : '') + ']'
                                }
                                i.paramsList.push(name);
                            });
                        }
                        //i.methodDescription = self._parseCode(markdown(i.description));
                        i.hasAccessType = i.access;
                        i.hasParams = i.paramsList.length;
                        if (i.paramsList.length) {
                            i.paramsList = i.paramsList.join(', ');
                        } else {
                            i.paramsList = ' ';
                        }
                        i.returnType = ' ';
                        if (i.return) {
                            i.hasReturn = true;
                            i.returnType = i.return.type;
                        }
                        //console.error(i);
                        opts.meta.is_constructor = [i];
                    }

                    classItems.forEach(function(i) {
                        switch (i.itemtype) {
                            case 'method':
                                i = self.augmentData(i);
                                i.paramsList = [];
                                if (i.params) {
                                    i.params.forEach(function(p, v) {
                                        var name = p.name;
                                        if (p.optional) {
                                            name = '[' + name + ((p.optdefault) ? '=' + p.optdefault : '') + ']'
                                        }
                                        i.paramsList.push(name);
                                    });
                                }
                                i.methodDescription = self._parseCode(markdown(i.description || ''));
                                if (i.example && i.example.length) {
                                    if (i.example.forEach) {
                                        var e = '';
                                        i.example.forEach(function(v) {
                                            e += self._parseCode(markdown(v));
                                        });
                                        i.example = e;
                                    } else {
                                        i.example = self._parseCode(markdown(i.example));
                                    }
                                }
                                i.hasAccessType = i.access;
                                i.hasParams = i.paramsList.length;
                                if (i.paramsList.length) {
                                    i.paramsList = i.paramsList.join(', ');
                                } else {
                                    i.paramsList = ' ';
                                }
                                i.returnType = ' ';
                                if (i.return) {
                                    i.hasReturn = true;
                                    i.returnType = i.return.type;
                                }

                                // If this item is provided by a module other
                                // than the module that provided the original
                                // class, add the original module name to the
                                // item's `providedBy` property so we can
                                // indicate the relationship.
                                if ((i.submodule || i.module) !== (v.submodule || v.module)) {
                                    i.providedBy = (i.submodule || i.module);
                                }

                                opts.meta.methods.push(i);
                                break;
                            case 'property':
                                i = self.augmentData(i);
                                i.propertyDescription = self._parseCode(markdown(i.description || ''));
                                if (!i.type) {
                                    i.type = 'unknown';
                                }
                                if (i.final === '') {
                                    i.final = true;
                                }
                                if (i.example && i.example.length) {
                                    if (i.example.forEach) {
                                        var e = '';
                                        i.example.forEach(function(v) {
                                            e += self._parseCode(markdown(v));
                                        });
                                        i.example = e;
                                    } else {
                                        i.example = self._parseCode(markdown(i.example));
                                    }
                                }

                                // If this item is provided by a module other
                                // than the module that provided the original
                                // class, add the original module name to the
                                // item's `providedBy` property so we can
                                // indicate the relationship.
                                if ((i.submodule || i.module) !== (v.submodule || v.module)) {
                                    i.providedBy = (i.submodule || i.module);
                                }

                                opts.meta.properties.push(i);
                                break;

                            case 'attribute': // fallthru
                            case 'config':
                                i = self.augmentData(i);
                                i.attrDescription = self._parseCode(markdown(i.description || ''));

                                if (i.itemtype === 'config') {
                                    i.config = true;
                                } else {
                                    i.emit = self.options.attributesEmit;
                                }

                                if (i.example && i.example.length) {
                                    if (i.example.forEach) {
                                        var e = '';
                                        i.example.forEach(function(v) {
                                            e += self._parseCode(markdown(v));
                                        });
                                        i.example = e;
                                    } else {
                                        i.example = self._parseCode(markdown(i.example));
                                    }
                                }

                                // If this item is provided by a module other
                                // than the module that provided the original
                                // class, add the original module name to the
                                // item's `providedBy` property so we can
                                // indicate the relationship.
                                if ((i.submodule || i.module) !== (v.submodule || v.module)) {
                                    i.providedBy = (i.submodule || i.module);
                                }

                                opts.meta.attrs.push(i);
                                break;
                            case 'event':
                                i = self.augmentData(i);
                                i.eventDescription = self._parseCode(markdown(i.description || ''));

                                if (i.example && i.example.length) {
                                    if (i.example.forEach) {
                                        var e = '';
                                        i.example.forEach(function(v) {
                                            e += self._parseCode(markdown(v));
                                        });
                                        i.example = e;
                                    } else {
                                        i.example = self._parseCode(markdown(i.example));
                                    }
                                }

                                // If this item is provided by a module other
                                // than the module that provided the original
                                // class, add the original module name to the
                                // item's `providedBy` property so we can
                                // indicate the relationship.
                                if ((i.submodule || i.module) !== (v.submodule || v.module)) {
                                    i.providedBy = (i.submodule || i.module);
                                }

                                opts.meta.events.push(i);
                                break;
                        }
                    });

                    opts.meta.attrs.sort(self.nameSort);
                    opts.meta.events.sort(self.nameSort);
                    opts.meta.methods.sort(self.nameSort);
                    opts.meta.properties.sort(self.nameSort);

                    if (!opts.meta.methods.length) {
                        delete opts.meta.methods;
                    }
                    if (!opts.meta.properties.length) {
                        delete opts.meta.properties;
                    }
                    if (!opts.meta.attrs.length) {
                        delete opts.meta.attrs;
                    }
                    if (!opts.meta.events.length) {
                        delete opts.meta.events;
                    }

                    var view   = new Y.DocView(opts.meta);
                    self.render('{{>classes}}', view, opts.layouts.main, opts.partials, stack.add(function(err, html) {
                        self.files++;
                        if (self.options.dumpview) {
                            Y.Files.writeFile(path.join(self.options.outdir, 'json', 'classes_' + v.name + '.json'), JSON.stringify(view), stack.add(noop));
                        }
                        Y.Files.writeFile(path.join(self.options.outdir, 'classes', v.name + '.html'), html, stack.add(noop));
                    }));
                });
            });

            stack.done(function() {
                Y.log('Finished writing class files', 'info', 'builder');
                cb();
            });
        },
        /**
        * Sort method of array of objects with a property called __name__
        * @method nameSort
        * @param {Object} a First object to compare
        * @param {Object} b Second object to compare
        * @return {Number} 1, -1 or 0 for sorting.
        */
        nameSort: function(a, b) {
            if (!a.name || !b.name) {
                return 0;
            }
            var an = a.name.toLowerCase(),
                bn = b.name.toLowerCase(),
                ret = 0;

            if (an < bn) {
                ret = -1;
            }
            if (an > bn) {
                ret =  1
            }
            return ret;
        },
        /**
        * Generates the syntax files under `"out"/files/`
        * @method writeFiles
        * @param {Callback} cb The callback to execute after it's completed
        */
        writeFiles: function(cb) {
            var self = this;
            var stack = new Y.Parallel();

            Y.log('Writing (' + Object.keys(self.data.files).length + ') source files', 'info', 'builder');
            Y.each(self.data.files, function(v) {
                Y.prepare(themeDir, self.getProjectMeta(), function(err, opts) {
                    if (err) {
                        console.log(err);
                    }
                    if (!v.name) {
                        return;
                    }
                    opts.meta.title = self.data.project.name;

                    opts.meta.moduleName = v.name;
                    opts.meta.projectRoot = '../';
                    opts.meta.projectAssets = '../assets';

                    opts = self.populateClasses(opts);
                    opts = self.populateModules(opts);
                    opts = self.populateFiles(opts);

                    opts.meta.fileName = v.name;
                    Y.Files.readFile((v.path || v.name), encoding='utf8', stack.add(Y.rbind(function(err, data, opts, v) {
                        opts.meta.fileData = data;
                        var view   = new Y.DocView(opts.meta, 'index');
                        self.render('{{>files}}', view, opts.layouts.main, opts.partials, function(err, html) {
                            self.files++;
                            if (self.options.dumpview) {
                                Y.Files.writeFile(path.join(self.options.outdir, 'json', 'files_' + self.filterFileName(v.name) + '.json'), JSON.stringify(view), stack.add(noop));
                            }
                            Y.Files.writeFile(path.join(self.options.outdir, 'files', self.filterFileName(v.name) + '.html'), html, stack.add(noop));
                        });

                    }, this, opts, v)));
                });
            });

            stack.done(function() {
                Y.log('Finished writing source files', 'info', 'builder');
                cb();
            });
        },
        writeAPIMeta: function(cb) {
            Y.log('Writing API Meta Data', 'info', 'builder');

            var opts = { meta: {} }, self = this;
            opts = this.populateClasses(opts);
            opts = this.populateModules(opts);

            ['classes', 'modules'].forEach(function(id) {
                opts.meta[id].forEach(function(v, k) {
                    opts.meta[id][k] = v.name;
                });
                opts.meta[id].sort();
            });


            var apijs = 'YUI.add("yuidoc-meta", function(Y) {\n' +
                '   Y.YUIDoc = { meta: ' + JSON.stringify(opts.meta) + ' };\n' +
                '});';

            Y.Files.writeFile(path.join(self.options.outdir, 'api.js'), apijs, cb);
        },
        /**
        * Normalizes a file path to a writable filename:
        *
        *    var path = 'lib/file.js';
        *    returns 'lib_file.js';
        *
        * @method filterFileName
        * @param {String} f The filename to normalize
        * @return {String} The filtered file path
        */
        filterFileName: function(f) {
            return f.replace(/\//g, '_');
        },
        /**
        * Compiles the templates from the meta-data provided by DocParser
        * @method compile
        * @param {Callback} cb The callback to execute after it's completed
        */
        compile: function(cb) {
            var self = this;
            var starttime = (new Date()).getTime();
            Y.log('Compiling Templates', 'info', 'builder');


            this.mixExternal(function() {
                self.makeDirs(function() {
                    Y.log('Copying Assets', 'info', 'builder');
                    Y.Files.copyAssets(path.join(themeDir, 'assets'), path.join(self.options.outdir, 'assets'), true, function() {
                        var cstack = new Y.Parallel();
                        self.writeModules(cstack.add(function() {
                            self.writeClasses(cstack.add(noop));
                        }));
                        self.writeFiles(cstack.add(noop));
                        self.writeIndex(cstack.add(noop));
                        self.writeAPIMeta(cstack.add(noop));
                        cstack.done(function() {
                            var endtime = (new Date()).getTime();
                            var timer = ((endtime - starttime) / 1000) + ' seconds';
                            Y.log('Finished writing ' + self.files + ' files in ' + timer, 'info', 'builder');
                            if (cb) { cb(); }
                        });
                    });
                });
            });
        }
    }
});
