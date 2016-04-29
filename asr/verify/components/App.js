import React from 'react';
import Influx from 'react-influx';
import fetch from '../../libs/fetch.es6';
import {ifcat} from '../../libs/utils';
import AceEditor from 'react-ace';

import 'brace/mode/json';
import 'brace/theme/monokai';

class App extends Influx.Component {
  constructor(...args) {
    super(...args);

    this.state = {posts: [], post: {}};
  }

  async componentWillMount() {
    const {body: {data: {posts}}} = await fetch('/post/all');
    this.setState({posts});
  }

  async _updateSelectedPost() {
    const {_id} = this.state;

    try {
      await fetch(`/post/${_id}/update`, {
        body: {post: JSON.parse(this._value)},
        method: 'post'
      });

      window.location.reload();
    } catch (e) {
      alert(e.message);
    }
  }

  async _verifySelectedPost() {
    const {_id} = this.state;

    try {
      await fetch(`/post/${_id}/verify`, {
        method: 'post'
      });

      window.location.reload();
    } catch (e) {
      alert(e.message);
    }
  }

  async _deleteSelectedPost() {
    const {_id} = this.state;

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

  async _updateValue(value) {
    this._value = value;
  }

  render() {
    const posts = this.state.posts.map(post => (
      <div key={post._id}>
        <div className='post flex' onClick={() => this.setState({post, _id: post._id})}>
          <div className='box'>
            <div className='id'>{post._id} by {post.userId}</div>
            <div className='description'>{post.description}</div>
            <div>
              <div className='tag'>{ifcat({verified: post.verified, unverified: !post.verified})}</div>
              <div className='tag'>{ifcat({deleted: post.deleted, active: !post.deleted})}</div>
            </div>
          </div>
          { post._id === this.state._id ?
            <div className='flex center' style={{maxWidth: 100}} onClick={() => this._updateSelectedPost()}>
              <div className='button'>Update</div>
            </div> : null }
          { post._id === this.state._id ?
            <div className='flex center' style={{maxWidth: 100}} onClick={() => this._verifySelectedPost()}>
              <div className='button'>Verify</div>
            </div> : null }
          { post._id === this.state._id ?
            <div className='flex center' style={{maxWidth: 100}} onClick={() => this._deleteSelectedPost()}>
              <div className='button'>Delete</div>
            </div> : null }
        </div>
        { post._id === this.state._id ? <div className='flex'>
          <AceEditor ref='editor' mode='json' height='260px' width='100%' theme='monokai' name={post._id}
                     showGutter={false} value={JSON.stringify(this.state.post, null, 2)}
                     editorProps={{$blockScrolling: true}} onChange={value => this._updateValue(value)}/>
        </div> : null }
      </div>
    ));

    return (
      <div>{posts}</div>
    );
  }
}

export default App;
