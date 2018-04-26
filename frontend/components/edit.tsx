import * as React from "react";
import { Component } from "react";

import * as CodeMirror from "react-codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/mode/markdown/markdown";

import Preview from "./preview";
import FeedCard from "./feed-card";

import history from "../lib/history";
import { User } from "../lib/user";
import * as utility from "../lib/utility";
import { getTopicsAndMentionsFromHTML, FeedInfo } from "../lib/feed";
import { renderMarkdown } from "../lib/markdown";

interface Props {
  cancel: () => void;
  user: User;
  feedInfo ?: FeedInfo;
}
interface State {
  code: string;
  previewIsOn: boolean;
  topics: string[];
  hiddenTopics: { [key: string]: boolean };
  mentions: { name: string; address: string }[];
  hiddenMentions: { [key: string]: boolean }; // key is address
  replies: { name: string; address: string }[];
  hiddenReplies: { [key: string]: boolean};  // key is address
}

export default class Edit extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      code:
        window.localStorage["markdown-cache"] ||
        `<!-- Enter your text below -->
`,
      previewIsOn: false,
      topics: [],
      hiddenTopics: {},
      mentions: [],
      hiddenMentions: {},
      replies: [],
      hiddenReplies: {}
    };
  }

  componentDidMount() {
    console.log("@@ MOUNT Edit @@");
    this.checkTopicsAndMentions();

    this.analyzeReplies();
  }

  async analyzeReplies() {
    if (!this.props.feedInfo) {
      return;
    }
    const feedInfo = this.props.feedInfo;
    let transactionInfo = feedInfo.transactionInfo;
    const replies = [];
    const exists = {}

    while (transactionInfo) {
      const address = transactionInfo.from;
      const name = ( await this.props.user.getUserInfo(address) ).name;
      if (!exists[address]) {
        exists[address] = true;
        replies.push({name, address});  
      }

      if (transactionInfo.decodedInputData.name === "post") {
        break;
      } else if (transactionInfo.decodedInputData.name === "repost") {
        const parentTransactionHash = transactionInfo.decodedInputData.params["parentTransactionHash"].value;
        const parentTransactionBlockNumber = transactionInfo.decodedInputData.params["parentTransactionBlockNumber"].value;
        const parentTransactionMessageHash = transactionInfo.decodedInputData.params["parentTransactionMessageHash"].value;
        transactionInfo = await this.props.user.getTransactionInfo('', parentTransactionBlockNumber, parentTransactionMessageHash, parentTransactionHash);  
      } else {
        break;
      }
    }

    this.setState({
      replies
    })
  }

  private updateCode = (newCode: string) => {
    this.setState({ code: newCode }, () => {
      window.localStorage["markdown-cache"] = newCode;
      this.checkTopicsAndMentions();
    });
  };

  private checkTopicsAndMentions() {
    // check topics and mentions
    getTopicsAndMentionsFromHTML(
      renderMarkdown(this.state.code),
      this.props.user
    ).then(({ topics, mentions }) => {
      if (
        JSON.stringify(this.state.topics) !== JSON.stringify(topics) ||
        JSON.stringify(this.state.mentions) !== JSON.stringify(mentions)
      ) {
        this.setState({
          topics,
          mentions
        });
      }
    });
  }

  private postFeed = async () => {
    // TODO: validate feed
    const user = this.props.user,
      content = this.state.code.trim();

    const topics = [];
    for (const topic of this.state.topics) {
      if (!this.state.hiddenTopics[topic]) {
        topics.push(topic);
      }
    }

    // TODO: replies
    const replies = [];
    for (const reply of this.state.replies) {
      if (!this.state.hiddenReplies[reply.address]) {
        replies.push(reply.address);
      }
    }

    // TODO: mentions
    const mentions = [];
    for (const mention of this.state.mentions) {
      if (!this.state.hiddenMentions[mention.address]) {
        mentions.push(mention.address);
      }
    }

    console.log("post feed         : ", this.state.code);
    console.log("     width replies: ", replies);
    console.log("     with topics  : ", topics);
    console.log("     with mentions: ", mentions);

    const tags = Array.from(new Set([...topics, ...mentions, ...replies]));
    try {
      await user.postFeed(content, tags);
      window.localStorage["markdown-cache"] = "";
      this.props.cancel();
    } catch (error) {
      alert(error);
    }
  };

  private togglePreview = () => {
    this.setState({ previewIsOn: !this.state.previewIsOn });
  };

  private toggleTopic = (topic: string) => {
    return () => {
      this.state.hiddenTopics[topic] = !this.state.hiddenTopics[topic];
      this.forceUpdate();
    };
  };

  private toggleMention = (address: string) => {
    return () => {
      this.state.hiddenMentions[address] = !this.state.hiddenMentions[address];
      this.forceUpdate();
    };
  };

  private toggleReply = (address: string) => {
    return () => {
      this.state.hiddenReplies[address] = !this.state.hiddenReplies[address];
      this.forceUpdate();
    };
  };

  clickEdit = (event)=> {
    event.preventDefault();
    event.stopPropagation();
  }

  render() {
    const options = {
      lineNumbers: false,
      autoFocus: true,
      mode: "markdown"
    };
    return (
      <div onClick={this.clickEdit} className={"edit " + (this.state.previewIsOn ? "preview-on" : "")}>
        {this.props.feedInfo ? <div>
          <h2 style={{textAlign: "center"}}>Reply to</h2>
          <FeedCard user={this.props.user} feedInfo={this.props.feedInfo} hideActionsPanel={true} /></div> : null}
        {this.state.previewIsOn ? (
          <div>
            <h2 style={{textAlign: "center"}}>Preview</h2>
            {/* topics */}
            <div className="topics-and-mentions card">
              {this.state.topics.length ? <p className="title">Post to topics:</p> : null}
              <div className="topics-list">
                {this.state.topics.map((topic, offset) => (
                  <div
                    className={
                      "topic " +
                      (this.state.hiddenTopics[topic] ? "hidden" : "")
                    }
                    key={offset}
                    onClick={this.toggleTopic(topic)}
                  >
                    {topic}
                  </div>
                ))}
              </div>
              {this.state.replies.length ? <p className="title">Reply to the following users:</p> : null}
              <div className="replies-list">
                {this.state.replies.map((reply, offset) => (
                  <div
                    className={
                      "reply " +
                      (this.state.hiddenReplies[reply.address]
                        ? "hidden"
                        : "")
                    }
                    key={offset}
                    onClick={this.toggleReply(reply.address)}
                  >
                    {reply.name}
                  </div>
                ))}
              </div>
              {this.state.mentions.length ? <p className="title">Mention the following users:</p> : null}
              <div className="mentions-list">
                {this.state.mentions.map((mention, offset) => (
                  <div
                    className={
                      "mention " +
                      (this.state.hiddenMentions[mention.address]
                        ? "hidden"
                        : "")
                    }
                    key={offset}
                    onClick={this.toggleMention(mention.address)}
                  >
                    {mention.name}
                  </div>
                ))}
              </div>
            </div>
            {/* preview */}
            <Preview markdown={this.state.code} user={this.props.user} />
          </div>
        ) : (
          <div>
          <h2 style={{textAlign: "center"}}>Write below</h2>
          <div className="editor-wrapper">
            <CodeMirror
              value={this.state.code}
              onChange={this.updateCode}
              options={options}
            />
          </div>
          </div>
        )}
        <div className="button-group">
          {this.state.previewIsOn ? (
            <div className="button" onClick={this.postFeed}>
              <i className="fa fa-paper-plane" aria-hidden="true" />
            </div>
          ) : null /* We can only show `post` button after user has seen the preview. */}

          <div className="button" onClick={this.togglePreview}>
            {this.state.previewIsOn ? (
              <i className="fa fa-eye-slash" aria-hidden="true" />
            ) : (
              <i className="fa fa-eye" aria-hidden="true" />
            )}
          </div>
          <div className="button" onClick={this.props.cancel}>
            <i className="fa fa-times" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }
}
