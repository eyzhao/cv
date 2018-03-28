all: \
    lib/js-yaml \
    lib/d3 \
    lib/jquery/jquery-3.3.1.min.js

lib/js-yaml:
	if [ -d $@ ]; \
	then (cd $@ && git pull); \
	else git clone https://github.com/nodeca/js-yaml.git $@; \
	fi 

lib/jquery/jquery-3.3.1.min.js:
	mkdir -p lib/jquery && wget https://code.jquery.com/jquery-3.3.1.min.js && mv jquery-3.3.1.min.js $@

lib/d3:
	rm -rf $@ && \
	    mkdir -p $@ && \
	    cd $@ && \
	    wget https://github.com/d3/d3/releases/download/v4.13.0/d3.zip && \
	    unzip d3.zip
