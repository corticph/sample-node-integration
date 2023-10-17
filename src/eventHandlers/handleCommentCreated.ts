import { CommentCreated } from "../types/events";

const handleCommentCreated = async (data: CommentCreated) => {
  const { comment, session } = data;
  // TODO: update your application with the comment
  console.log(
    `New Comment: ${comment.text} (Session ID: ${session.externalID})`
  );
};

export default handleCommentCreated;
