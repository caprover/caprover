/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

const CompLibrary = require('../../core/CompLibrary.js');
const MarkdownBlock = CompLibrary.MarkdownBlock;
/* Used to read markdown */
const Container = CompLibrary.Container;
const GridBlock = CompLibrary.GridBlock;

const siteConfig = require(process.cwd() + '/siteConfig.js');

function imgUrl(img) {
    return siteConfig.baseUrl + 'img/' + img;
}

function docUrl(doc, language) {
    return siteConfig.baseUrl + 'docs/' + (language ? language + '/' : '') + doc;
}

function pageUrl(page, language) {
    return siteConfig.baseUrl + (language ? language + '/' : '') + page;
}

class Button extends React.Component {
    render() {
        return (
            <div className="pluginWrapper buttonWrapper">
                <a className="button" href={this.props.href} target={this.props.target}>
                    {this.props.children}
                </a>
            </div>
        );
    }
}

Button.defaultProps = {
    target: '_self',
};

const SplashContainer = props => (
    <div className="homeContainer">
        <div className="homeSplashFade">
            <div className="wrapper homeWrapper">{props.children}</div>
        </div>
    </div>
);

const Logo = props => (
    <div className="projectLogo">
        <img src={props.img_src}/>
    </div>
);

const ProjectTitle = props => (
    <h2 className="projectTitle">
        {siteConfig.title}
        <small>{siteConfig.tagline}</small>
    </h2>
);

const PromoSection = props => (
    <div className="section promoSection">
        <div className="promoRow">
            <div className="pluginRowBlock">{props.children}</div>
        </div>
    </div>
);

class HomeSplash extends React.Component {
    render() {
        let language = this.props.language || '';
        return (
            <SplashContainer>
                <Logo img_src={imgUrl('captainduckduck.png')}/>
                <div className="inner">
                    <ProjectTitle/>
                    <PromoSection>
                        <Button href={docUrl('get-started.html', language)}>Get Started Now</Button>
                    </PromoSection>
                </div>
            </SplashContainer>
        );
    }
}

const Block = props => (
    <Container
        padding={['bottom', 'top']}
        id={props.id}
        background={props.background}>
        <GridBlock align="center" contents={props.children} layout={props.layout}/>
    </Container>
);

const FeaturesTop = props => (
    <Block layout="threeColumn">
        {[
            {
                content: 'does not like spending hours and days setting up a server, build tools, sending code to server, build it, get an SSL certificate, install it, update nginx over and over again.\n',
                image: imgUrl('icon/time.png'),
                imageAlign: 'top',
                title: 'A developer who...'
            },
            {
                content: 'uses expensive services like Heroku, Microsoft Azure and etc. And is interested in reducing their cost by 4x (Heroku charges 25$/month for their 1gb instance, the same server is 5$ on DigitalOcean!!)',
                image: imgUrl('icon/money.png'),
                imageAlign: 'top',
                title: 'A developer who... ' // extra spaces necessary as Docusaurus doesn't like repeated keys
            },
            {
                content: 'prefers to write more of `showResults(getUserList())` and not much of `apt-get install libstdc++6 > /dev/null`',
                image: imgUrl('icon/dev.png'),
                imageAlign: 'top',
                title: 'A developer who...  ' // extra spaces necessary as Docusaurus doesn't like repeated keys
            },
        ]}
    </Block>
);

const FeaturesBottom = props => (
    <Block layout="threeColumn">
        {[
            {
                content: 'enjoys a platform where installing MySQL, MongoDB and etc on their server is done by selecting from a dropdown and clicking on install!',
                image: imgUrl('icon/setup.png'),
                imageAlign: 'top',
                title: 'A developer who...'
            },
            {
                content: 'likes to enjoy the power of Docker and nginx without having to learn them or deal with their settings scripts to make things work!!',
                image: imgUrl('icon/server.png'),
                imageAlign: 'top',
                title: 'A developer who... ' // extra spaces necessary as Docusaurus doesn't like repeated keys
            },
            {
                content: 'knows Docker and nginx inside out, and enjoys a platform where basic operations are done, yet allowing them to customize any specific settings if they need to',
                image: imgUrl('icon/customize.png'),
                imageAlign: 'top',
                title: 'A developer who...  ' // extra spaces necessary as Docusaurus doesn't like repeated keys
            },
        ]}
    </Block>
);

const FeatureCallout = props => (
    <div
        className="productShowcaseSection paddingBottom"
        style={{textAlign: 'center'}}>
        <h2>What's this?</h2>
        <MarkdownBlock>
            Captain is an extremely easy to use app/database deployment & web server manager for your NodeJS,
            Python, PHP, Ruby, MySQL, MongoDB, Postgres, WordPress (and etc) applications. It's blazingly fast and very
            robust as
            it uses Docker, nginx, LetsEncrypt and NetData under the hood behind its simple-to-use interface.
        </MarkdownBlock>
    </div>
);

const CaptainInOnePhoto = props => (

    <div>
        <Block>
            {[
                {
                    image: imgUrl('captain-in-one-picture.png'),
                    imageAlign: 'bottom',
                },
            ]}
        </Block>
        <Block background="light">
            {[
                {
                    title: 'Captain Architecture in a Glace',
                    image: imgUrl('captain-architecture.png'),
                    imageAlign: 'bottom',
                },
            ]}
        </Block>
    </div>
);

const QuickDemo = props => (
    <Block background="light">
        {[
            {
                content:
                    'From `http://localhost:3000` to `https://www.awesome.com` in seconds',
                imageAlign: 'right',
                title: 'App Deployment Made Easy',
                image: imgUrl('screenshot.png')
            },
        ]}
    </Block>
);

const TerminalDemo = props => (
    <Block id="try" background="dark">
        {[
            {
                content:
                '<script src="https://asciinema.org/a/u1v8WDqHIHhRD8Uk2hzrjNz14.js" ' +
                'id="asciicast-u1v8WDqHIHhRD8Uk2hzrjNz14" async></script>',
                imageAlign: 'left',
                title: 'Installation + Setup + Deploy in 1 minute!',
            },
        ]}
    </Block>
);

const FullTutorial = props => (

    <div
        className="productShowcaseSection paddingBottom"
        style={{textAlign: 'center'}}>
        <Block id="tutorial" background="light">
            {[
                {
                    content: '<a ' +
                    'href="https://www.youtube.com/watch?v=XDrTmGSDW3s"' +
                    ' target="_blank" ' +
                    ' rel="noreferrer noopener">' +
                    '<img src="/img/screenshots.gif"/></a>',
                    imageAlign: 'left',
                    title: 'Full Video Tutorial',
                },
            ]}
        </Block>
    </div>
);

const Showcase = props => {
    if ((siteConfig.users || []).length === 0) {
        return null;
    }
    let language = props.language || '';
    const showcase = siteConfig.users
        .filter(user => {
            return user.pinned;
        })
        .map((user, i) => {
            return (
                <a href={user.infoLink} key={i}>
                    <img src={user.image} alt={user.caption} title={user.caption}/>
                </a>
            );
        });

    return (
        <div className="productShowcaseSection paddingBottom">
            <h2>{"Ready to give it a shot?"}</h2>
            <p>Setting up and playing with CaptainDuckDuck takes around 10 minutes on the first try</p>
            <Button href={docUrl('get-started.html', language)}>Get Started Now</Button>
        </div>
    );
};

class Index extends React.Component {
    render() {
        let language = this.props.language || '';

        return (
            <div>
                <HomeSplash language={language}/>
                <div className="mainContainer">
                    <FeatureCallout/>
                    <QuickDemo/>
                    <div>
                        <div
                            className="productShowcaseSection"
                            style={{textAlign: 'center'}}>
                            <h2>Who Should Care About This?</h2>
                        </div>
                    </div>
                    <FeaturesTop/>
                    <FeaturesBottom/>
                    <FullTutorial/>
                    <CaptainInOnePhoto/>
                    <Showcase language={language}/>
                </div>
            </div>
        );
    }
}

module.exports = Index;
