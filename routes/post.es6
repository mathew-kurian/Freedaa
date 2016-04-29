import {Router} from 'express';
import * as Post from '../core/controllers/post.es6';

const router = new Router();

router.get('/all', async (req, res) => {
  try {
    res.json({data: {posts: await Post.getPosts()}});
  } catch (e) {
    res.json({status: 1, message: 'Could not find posts'});
  }
});

router.post('/:id/update', async (req, res) => {
  const {id} = req.params;
  const {post} = req.body;

  try {
    res.json({data: {post: await Post.updatePost(id, post)}});
  } catch (e) {
    res.json({status: 1, message: 'Could not update post'});
  }
});

router.post('/:id/verify', async (req, res) => {
  const {id} = req.params;

  try {
    res.json({data: {post: await Post.verifyPost(id)}});
  } catch (e) {
    res.json({status: 1, message: 'Could not update post'});
  }
});

router.post('/:id/delete', async (req, res) => {
  const {id} = req.params;
  const {reason} = req.body;

  try {
    res.json({data: {post: await Post.removePost(id, reason)}});
  } catch (e) {
    res.json({status: 1, message: 'Could not update post'});
  }
});

export default router;
