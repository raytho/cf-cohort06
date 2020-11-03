/* eslint-disable react/jsx-props-no-spreading */
import React, { useState, useContext } from 'react';
import { Context } from '../../../Context';

import GetData from '../../../containers/GetData';
import UserDeleteModal from './UserDeleteModal';
import '../../../assets/styles/components/RoleManage/ItemUser.scss';


const UserItemInvited = () =>{

   const API = 'https://ancient-fortress-28096.herokuapp.com/api/';
   const { userDeleted } = useContext(Context);
   const [modal, setModal] = useState(false);
   const [userId, setUserId] = useState('');
   const token = window.sessionStorage.getItem('token');
   const type = 'invite';

   const handleModalOpen = id => {
      setModal(true)
      setUserId(id)
   }
   const handleModalClose = () => {
      setModal(false)
   }

   return (
      <GetData api={`${API}superAdmin/getInvitedUsers`} token={token} change={userDeleted}>
         {
            ({ loading, error, data }) => {
               if (loading) return <p>Cargando...</p>
               if (error) return <p>¡Error!</p>
               return (
                <ul>
                  {
                     data.map(item =>
                        <li key={item.userId} className='Role__item'>
                           <div>
                              <span className='Role__item-body'>
                                 <p>{item.role}</p>
                                 <p>{item.userId}</p>
                                 <p>{item.email} {item.lastName}</p>
                                 <span>Invitado</span>
                              </span>
                           </div>
                           <button type='button' onClick={() => handleModalOpen(item.userId)}>X</button>
                        </li>
                     )
                  }
                  <UserDeleteModal
                     handleModalClose={handleModalClose}
                     modalIsOpen={modal}
                     endpoint={`superAdmin/users-invitation/${userId}`}
                     type={type}
                  />
                </ul>
               )
            }
         }
      </GetData>
   )
}

export default UserItemInvited;