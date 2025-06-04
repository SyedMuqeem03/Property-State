import prisma from "../lib/prisma.js";

export const getPosts = async (req, res) => {
  const query = req.query;

  try {
    console.log('📊 Getting posts from DATABASE with filters:', query);
    
    // Build where clause for filtering
    const where = {};
    
    if (query.city) {
      where.city = {
        contains: query.city,
        mode: 'insensitive'
      };
    }
    
    if (query.type) {
      where.type = query.type;
    }
    
    if (query.property) {
      where.property = query.property;
    }
    
    if (query.bedroom) {
      where.bedroom = {
        gte: parseInt(query.bedroom)
      };
    }
    
    if (query.minPrice || query.maxPrice) {
      where.price = {};
      if (query.minPrice) where.price.gte = parseInt(query.minPrice);
      if (query.maxPrice) where.price.lte = parseInt(query.maxPrice);
    }

    // Try with a more selective query to avoid the type conversion errors
    try {
      const posts = await prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          address: true,
          city: true,
          bedroom: true,
          bathroom: true,
          type: true,
          property: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          // Skip problematic latitude/longitude fields initially
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log(`✅ Fetched ${posts.length} posts from database`);

      // Transform posts for the frontend
      const transformedPosts = posts.map(post => {
        return {
          ...post,
          // Add nulls for fields we excluded in the select
          latitude: null,
          longitude: null,
          
          ownerInfo: post.user ? {
            id: post.user.id,
            username: post.user.username,
            email: post.user.email,
            fullName: post.user.username,
            avatar: post.user.avatar,
            verified: false,
            showContactInfo: true,
            memberSince: post.user.createdAt,
            location: `${post.city || 'Unknown City'}`,
            userType: 'standard'
          } : {
            id: 'unknown',
            username: 'Unknown User',
            email: '',
            fullName: 'Unknown',
            avatar: '',
            verified: false,
            showContactInfo: false,
            memberSince: new Date().toISOString(),
            location: `${post.city || 'Unknown City'}`,
            userType: 'standard'
          }
        };
      });

      console.log(`✅ Returning ${transformedPosts.length} posts from DATABASE`);
      res.status(200).json(transformedPosts);
    } catch (err) {
      // If that fails, fallback to basic query without relationships
      console.error('⚠️ Error with full posts query, trying simpler query:', err.message);
      const basicPosts = await prisma.post.findMany({
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          address: true,
          city: true,
          bedroom: true,
          bathroom: true,
          type: true,
          property: true,
          createdAt: true,
          updatedAt: true,
          userId: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // Format the basic posts with empty owner info
      const simplePosts = basicPosts.map(post => ({
        ...post,
        latitude: null,
        longitude: null,
        ownerInfo: {
          id: 'unknown',
          username: 'Unknown User',
          fullName: 'Unknown',
          email: '',
          avatar: '',
          verified: false,
          showContactInfo: false,
          memberSince: new Date().toISOString(),
          location: post.city || 'Unknown',
          userType: 'standard'
        }
      }));
      
      console.log(`✅ Returning ${simplePosts.length} basic posts as fallback`);
      res.status(200).json(simplePosts);
    }
  } catch (err) {
    console.error('❌ Database error in getPosts:', err);
    // Return empty array instead of 500 error
    res.status(200).json([]);
  }
};

export const addPost = async (req, res) => {
  try {
    const body = req.body;
    const tokenUserId = req.userId;

    console.log('📝 Creating post in DATABASE:', body.title);
    console.log('👤 User ID from token:', tokenUserId);

    // Validate required fields
    if (!body.title || !body.price || !body.city) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Ensure numeric values are properly parsed and handle potential strings
    const numericPrice = typeof body.price === 'string' ? parseFloat(body.price) : body.price;
    const numericBedroom = body.bedroom ? (typeof body.bedroom === 'string' ? parseInt(body.bedroom) : body.bedroom) : 0;
    const numericBathroom = body.bathroom ? (typeof body.bathroom === 'string' ? parseFloat(body.bathroom) : body.bathroom) : 0.0;
    
    // Handle coordinates - set to null if they cause issues
    let latitude = null;
    let longitude = null;
    
    if (body.latitude !== undefined && body.latitude !== null) {
      try {
        latitude = typeof body.latitude === 'string' ? parseFloat(body.latitude) : body.latitude;
      } catch (e) {
        console.warn('⚠️ Could not parse latitude, setting to null');
      }
    }
    
    if (body.longitude !== undefined && body.longitude !== null) {
      try {
        longitude = typeof body.longitude === 'string' ? parseFloat(body.longitude) : body.longitude;
      } catch (e) {
        console.warn('⚠️ Could not parse longitude, setting to null');
      }
    }

    // Create post with postDetail in database - handle potential errors with coordinates
    try {
      const newPost = await prisma.post.create({
        data: {
          title: body.title,
          price: numericPrice,
          images: body.images || [],
          address: body.address || '',
          city: body.city,
          bedroom: numericBedroom,
          bathroom: numericBathroom,
          // Skip coordinates if they could cause issues
          // latitude: latitude,
          // longitude: longitude,
          type: body.type || 'rent',
          property: body.property || 'apartment',
          userId: tokenUserId,
          postDetail: body.postDetail ? {
            create: {
              desc: body.postDetail.desc || '',
              utilities: body.postDetail.utilities || '',
              pet: body.postDetail.pet || '',
              income: body.postDetail.income || '',
              size: body.postDetail.size ? parseInt(body.postDetail.size) : null,
              school: body.postDetail.school ? parseInt(body.postDetail.school) : null,
              bus: body.postDetail.bus ? parseInt(body.postDetail.bus) : null,
              restaurant: body.postDetail.restaurant ? parseInt(body.postDetail.restaurant) : null,
            }
          } : undefined
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              createdAt: true
            }
          },
          postDetail: true
        }
      });

      // Transform response to include ownerInfo
      const responsePost = {
        ...newPost,
        ownerInfo: {
          id: newPost.user.id,
          username: newPost.user.username,
          email: newPost.user.email,
          fullName: newPost.user.username,
          avatar: newPost.user.avatar,
          verified: false,
          showContactInfo: true,
          memberSince: newPost.user.createdAt,
          location: `${newPost.city}`,
          userType: 'standard'
        }
      };

      console.log('✅ Post created successfully in DATABASE:', newPost.id);
      res.status(201).json(responsePost);
      
    } catch (innerErr) {
      // If post creation fails due to coordinate types, try again without them
      console.warn('⚠️ Post creation failed, retrying without coordinates:', innerErr.message);
      
      const newPost = await prisma.post.create({
        data: {
          title: body.title,
          price: numericPrice,
          images: body.images || [],
          address: body.address || '',
          city: body.city,
          bedroom: numericBedroom,
          bathroom: numericBathroom,
          // Skip problematic fields
          type: body.type || 'rent',
          property: body.property || 'apartment',
          userId: tokenUserId,
          postDetail: body.postDetail ? {
            create: {
              desc: body.postDetail.desc || '',
              utilities: body.postDetail.utilities || '',
              pet: body.postDetail.pet || '',
              income: body.postDetail.income || '',
              size: body.postDetail.size ? parseInt(body.postDetail.size) : null,
              school: body.postDetail.school ? parseInt(body.postDetail.school) : null,
              bus: body.postDetail.bus ? parseInt(body.postDetail.bus) : null,
              restaurant: body.postDetail.restaurant ? parseInt(body.postDetail.restaurant) : null,
            }
          } : undefined
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              createdAt: true
            }
          },
          postDetail: true
        }
      });
      
      const responsePost = {
        ...newPost,
        ownerInfo: {
          id: newPost.user.id,
          username: newPost.user.username,
          email: newPost.user.email,
          fullName: newPost.user.username,
          avatar: newPost.user.avatar,
          verified: false,
          showContactInfo: true,
          memberSince: newPost.user.createdAt,
          location: `${newPost.city}`,
          userType: 'standard'
        }
      };

      console.log('✅ Post created successfully (without coordinates) in DATABASE:', newPost.id);
      res.status(201).json(responsePost);
    }
    
  } catch (err) {
    console.error('❌ Database error creating post:', err);
    res.status(500).json({ message: "Failed to create post in database", error: err.message });
  }
};

export const getPost = async (req, res) => {
  const id = req.params.id;
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postDetail: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            createdAt: true
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Transform to include ownerInfo
    const transformedPost = {
      ...post,
      ownerInfo: {
        id: post.user.id,
        username: post.user.username,
        email: post.user.email,
        fullName: post.user.username,
        avatar: post.user.avatar,
        verified: false,
        showContactInfo: true,
        memberSince: post.user.createdAt,
        location: `${post.city}`,
        userType: 'standard'
      }
    };

    res.status(200).json(transformedPost);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get post" });
  }
};

export const updatePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;
  const body = req.body;

  try {
    // First check if post exists and belongs to this user
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { userId: true }
    });
    
    if (!existingPost) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    if (existingPost.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }
    
    // Handle post details update if provided
    if (body.postDetail) {
      const postDetail = body.postDetail;
      delete body.postDetail; // Remove from main body to avoid Prisma issues
      
      // Update post details separately
      await prisma.postDetail.upsert({
        where: { postId: id },
        update: {
          desc: postDetail.desc,
          utilities: postDetail.utilities,
          pet: postDetail.pet,
          income: postDetail.income,
          size: postDetail.size ? parseInt(postDetail.size) : null,
          school: postDetail.school ? parseInt(postDetail.school) : null,
          bus: postDetail.bus ? parseInt(postDetail.bus) : null,
          restaurant: postDetail.restaurant ? parseInt(postDetail.restaurant) : null,
        },
        create: {
          postId: id,
          desc: postDetail.desc || '',
          utilities: postDetail.utilities || '',
          pet: postDetail.pet || '',
          income: postDetail.income || '',
          size: postDetail.size ? parseInt(postDetail.size) : null,
          school: postDetail.school ? parseInt(postDetail.school) : null,
          bus: postDetail.bus ? parseInt(postDetail.bus) : null,
          restaurant: postDetail.restaurant ? parseInt(postDetail.restaurant) : null,
        }
      });
    }

    // Update main post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        title: body.title,
        price: body.price ? parseInt(body.price) : undefined,
        images: body.images,
        address: body.address,
        city: body.city,
        bedroom: body.bedroom ? parseInt(body.bedroom) : undefined,
        bathroom: body.bathroom ? parseFloat(body.bathroom) : undefined,
        latitude: body.latitude,
        longitude: body.longitude,
        type: body.type,
        property: body.property,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            createdAt: true
          }
        },
        postDetail: true
      }
    });

    // Transform to include ownerInfo
    const transformedPost = {
      ...updatedPost,
      ownerInfo: {
        id: updatedPost.user.id,
        username: updatedPost.user.username,
        email: updatedPost.user.email,
        fullName: updatedPost.user.username,
        avatar: updatedPost.user.avatar,
        verified: false,
        showContactInfo: true,
        memberSince: updatedPost.user.createdAt,
        location: `${updatedPost.city}`,
        userType: 'standard'
      }
    };
    
    res.status(200).json(transformedPost);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

export const deletePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    // First check if post exists and belongs to this user
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { userId: true }
    });
    
    if (!existingPost) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    if (existingPost.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }
    
    // Delete post (postDetail will be automatically deleted due to Cascade)
    await prisma.post.delete({
      where: { id }
    });
    
    res.status(200).json({ message: "Post deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};
