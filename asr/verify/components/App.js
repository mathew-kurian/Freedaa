import React from 'react';
import Influx from 'react-influx';
import fetch from '../../libs/fetch.es6';
import {ifcat} from '../../libs/utils';
import AceEditor from 'react-ace';
import moment from 'moment';

import 'brace/mode/json';
import 'brace/theme/xcode';

class App extends Influx.Component {
  constructor(...args) {
    super(...args);

    this.state = {posts: []};
  }

  async componentWillMount() {
    const {body: {data: {posts}}} = await fetch('/post/all');
    this.setState({posts});
  }

  async _updatePost(_id) {
    try {
      await fetch(`/post/${_id}/update`, {
        body: {post: JSON.parse(this.refs[`editor-${_id}`].editor.getValue())},
        method: 'post'
      });

      window.location.reload();
    } catch (e) {
      alert(e.message);
    }
  }

  async _verifyPost(_id) {
    try {
      await fetch(`/post/${_id}/verify`, {
        method: 'post'
      });

      window.location.reload();
    } catch (e) {
      alert(e.message);
    }
  }

  async _deletePost(_id) {
    try {
      await fetch(`/post/${_id}/delete`, {
        body: {reason: prompt('A reason for deleting')},
        method: 'post'
      });

      window.location.reload();
    } catch (e) {
      alert(e.message);
    }
  }

  render() {
    const posts = this.state.posts.map(post => {
      let period = '';
      if (post.start - Date.now() < 60 * 60 * 1000 * 12) {
        period = moment(post.start).format('h:mm a');
      } else {

        period = moment(post.start).format('MMM D h:mm a');
      }

      period += ' - ';
      if (post.end - Date.now() < 60 * 60 * 1000 * 18) {
        period += moment(post.end).format('h:mm a');
      } else {
        period += moment(post.end).format('MMM D h:mm a');
      }

      if (post.end < Date.now()) {
        period = 'EXPIRED';
      }

      let tag = '';
      if (post.global) {
        tag = 'GLOBAL - '
      } else if (post.national) {
        tag = 'USA - '
      }

      return (
        <div key={post._id}>
          <div className='post flex'>
            <div className='box' style={{margin: 10, minWidth: 200, width: 200}}>
              <div className='mobile' style={{marginBottom: 10}}>
                <div className='tag'>{ifcat({verified: post.verified, unverified: !post.verified})}</div>
                <div className='tag'>{ifcat({deleted: post.deleted, active: !post.deleted})}</div>
              </div>
              <div className='template'>
                <div className='image' style={{backgroundImage:`url("${post.image}")`}}></div>
                <div className='text'>
                  <div className='title'>{`${tag}${post.description}`}</div>
                  <div className='subtitle'>{`${period} · ${post.views} views`}</div>
                </div>
                <div className='clicker no-mobile' onClick={this._updatePost.bind(this, post._id)}>Update</div>
                <div className='clicker' onClick={this._verifyPost.bind(this, post._id)}>Verify</div>
                <div className='clicker' onClick={this._deletePost.bind(this, post._id)}>Delete</div>
              </div>
            </div>
            <div className='box no-mobile' style={{width: '90%', margin: 10}}>
              <div className='flex vertical full'>
                <div style={{marginBottom: 10}}>
                  <div className='tag'>{ifcat({verified: post.verified, unverified: !post.verified})}</div>
                  <div className='tag'>{ifcat({deleted: post.deleted, active: !post.deleted})}</div>
                </div>
                <div className='editor'>
                  <AceEditor ref={`editor-${post._id}`} mode='json' height='100%' width='100%' theme='xcode'
                             name={post._id}
                             showGutter={true} value={JSON.stringify(post, null, 2)}
                             editorProps={{$blockScrolling: true}}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });

    return (
      <div>{posts}</div>
    );
  }
}

export default App;
